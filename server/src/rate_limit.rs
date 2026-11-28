//! Slows down password guessing on `sign_in`.
//!
//! Wrong passwords are counted per account (the email or student ID typed) and
//! per client IP. After `free_failures` wrong passwords the key is locked for
//! `first_lock`; every wrong password after a lock ends locks it again for
//! `step` longer than the last time (account: 3 tries, then 1, 3, 5, 7 ...
//! minutes). A successful sign-in clears the account. A key with no attempts
//! for `FORGET_AFTER` (and no lock running) starts over.
//!
//! The lock is set when the attempt that would trigger it starts, not when it
//! fails, so firing many requests at once can't slip past the limit while
//! bcrypt is still checking the first ones. Attempts that succeed, or fail for
//! a reason other than a wrong password (e.g. the database is down), are given
//! back along with any lock they set.
//!
//! The counts live in memory: they reset when the server restarts and aren't
//! shared between instances (NurSet runs a single one).

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Clone, Copy)]
pub struct Policy {
    /// Wrong passwords allowed before the first lock.
    pub free_failures: u32,
    /// Length of the first lock.
    pub first_lock: Duration,
    /// How much longer each following lock is.
    pub step: Duration,
}

const MINUTE: Duration = Duration::from_secs(60);

/// One email or student ID: 3 tries, then locked 1 min, 3 min, 5 min, ...
pub const PER_ACCOUNT: Policy = Policy { free_failures: 3, first_lock: MINUTE, step: Duration::from_secs(2 * 60) };
/// One IP address across all accounts, so one device can't cycle through accounts.
pub const PER_IP: Policy = Policy { free_failures: 20, first_lock: MINUTE, step: Duration::from_secs(2 * 60) };

/// A key with no attempts for this long (and no lock running) starts over.
const FORGET_AFTER: Duration = Duration::from_secs(60 * 60);
/// Stale keys are swept once the map grows past this many.
const SWEEP_AT: usize = 10_000;

struct Entry {
    failures: u32,
    locks: u32,
    locked_until: Option<Instant>,
    last_attempt: Instant,
}

impl Entry {
    fn new(now: Instant) -> Self {
        Self { failures: 0, locks: 0, locked_until: None, last_attempt: now }
    }
    fn remaining_lock(&self, now: Instant) -> Option<Duration> {
        self.locked_until.filter(|&until| until > now).map(|until| until - now)
    }
    fn stale(&self, now: Instant) -> bool {
        self.remaining_lock(now).is_none() && now.duration_since(self.last_attempt) >= FORGET_AFTER
    }
}

#[derive(Default)]
pub struct LoginLimiter {
    entries: Mutex<HashMap<String, Entry>>,
}

/// One key an attempt was counted under, and whether starting it set a lock.
#[derive(Debug)]
struct Counted {
    key: String,
    set_lock: bool,
}

/// A sign-in attempt in progress; report how it went with `succeeded` or `not_counted`.
#[derive(Debug)]
pub struct Attempt {
    account: Counted,
    ip: Counted,
}

impl LoginLimiter {
    /// Counts a new attempt, or returns how long to wait while the account or
    /// IP is locked (the attempt is then not counted).
    pub fn begin(&self, identifier: &str, ip: &str) -> Result<Attempt, Duration> {
        let account_key = format!("account:{}", identifier.trim().to_lowercase());
        let ip_key = format!("ip:{ip}");
        let now = Instant::now();
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        if entries.len() >= SWEEP_AT {
            entries.retain(|_, e| !e.stale(now));
        }
        let wait = [&account_key, &ip_key]
            .into_iter()
            .filter_map(|k| entries.get(k.as_str()).and_then(|e| e.remaining_lock(now)))
            .max();
        if let Some(wait) = wait {
            return Err(wait);
        }
        let mut count = |key: String, policy: Policy| {
            let entry = entries.entry(key.clone()).or_insert_with(|| Entry::new(now));
            if entry.stale(now) {
                *entry = Entry::new(now);
            }
            entry.failures += 1;
            entry.last_attempt = now;
            // Assume this attempt fails; `succeeded` / `not_counted` undo the lock.
            let set_lock = entry.failures >= policy.free_failures;
            if set_lock {
                entry.locked_until = Some(now + policy.first_lock + policy.step * entry.locks);
                entry.locks += 1;
            }
            Counted { key, set_lock }
        };
        let account = count(account_key, PER_ACCOUNT);
        let ip = count(ip_key, PER_IP);
        Ok(Attempt { account, ip })
    }

    /// The password was right: clear the account and give the IP its attempt back.
    pub fn succeeded(&self, attempt: Attempt) {
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        entries.remove(&attempt.account.key);
        give_back(&mut entries, attempt.ip);
    }

    /// The attempt failed for a reason other than a wrong password.
    pub fn not_counted(&self, attempt: Attempt) {
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        give_back(&mut entries, attempt.account);
        give_back(&mut entries, attempt.ip);
    }
}

fn give_back(entries: &mut HashMap<String, Entry>, counted: Counted) {
    if let Some(entry) = entries.get_mut(&counted.key) {
        entry.failures = entry.failures.saturating_sub(1);
        if counted.set_lock {
            // Any earlier lock had already ended, or this attempt couldn't have started.
            entry.locks = entry.locks.saturating_sub(1);
            entry.locked_until = None;
        }
        if entry.failures == 0 {
            entries.remove(&counted.key);
        }
    }
}

/// "Too many sign-in attempts…" with the wait rounded up to whole minutes.
pub fn too_many_message(wait: Duration) -> String {
    let minutes = wait.as_secs().div_ceil(60).max(1);
    let unit = if minutes == 1 { "minute" } else { "minutes" };
    format!("Too many sign-in attempts. Please wait {minutes} {unit} and try again.")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Moves every lock and attempt time back, as if `by` had passed.
    fn advance(limiter: &LoginLimiter, by: Duration) {
        let mut entries = limiter.entries.lock().unwrap();
        for e in entries.values_mut() {
            e.last_attempt -= by;
            e.locked_until = e.locked_until.map(|t| t - by);
        }
    }

    fn fail(limiter: &LoginLimiter, who: &str) -> Result<(), Duration> {
        limiter.begin(who, "1.1.1.1").map(|_| ())
    }

    #[test]
    fn three_tries_then_locks_growing_by_two_minutes() {
        let l = LoginLimiter::default();
        for _ in 0..3 {
            fail(&l, "Juan@Example.com").expect("allowed");
        }
        // Locked for 1 minute, whatever the case or IP.
        let wait = l.begin("juan@example.com ", "2.2.2.2").expect_err("locked");
        assert!(wait <= MINUTE && wait > MINUTE - Duration::from_secs(5));
        // Another account is unaffected.
        assert!(fail(&l, "maria@example.com").is_ok());

        // Each wrong password after a lock ends: 3 min, then 5 min.
        for expected in [3, 5] {
            advance(&l, Duration::from_secs(10 * 60));
            fail(&l, "juan@example.com").expect("lock over");
            let wait = fail(&l, "juan@example.com").expect_err("locked again");
            let expected = Duration::from_secs(expected * 60);
            assert!(wait <= expected && wait > expected - Duration::from_secs(5), "{wait:?}");
        }
    }

    #[test]
    fn success_clears_the_account() {
        let l = LoginLimiter::default();
        fail(&l, "juan").expect("allowed");
        fail(&l, "juan").expect("allowed");
        // The third try succeeds: the lock it set is lifted and the count cleared.
        let third = l.begin("juan", "1.1.1.1").expect("allowed");
        l.succeeded(third);
        for _ in 0..3 {
            fail(&l, "juan").expect("allowed again");
        }
        assert!(fail(&l, "juan").is_err());
    }

    #[test]
    fn errors_other_than_wrong_password_are_not_counted() {
        let l = LoginLimiter::default();
        for _ in 0..10 {
            let a = l.begin("juan", "1.1.1.1").expect("allowed");
            l.not_counted(a);
        }
        assert!(fail(&l, "juan").is_ok());
    }

    #[test]
    fn limits_one_ip_across_accounts() {
        let l = LoginLimiter::default();
        for i in 0..PER_IP.free_failures {
            l.begin(&format!("user{i}"), "9.9.9.9").expect("allowed");
        }
        assert!(l.begin("someone-else", "9.9.9.9").is_err());
        assert!(l.begin("someone-else", "8.8.8.8").is_ok());
    }

    #[test]
    fn forgets_after_an_idle_hour() {
        let l = LoginLimiter::default();
        for _ in 0..3 {
            fail(&l, "juan").expect("allowed");
        }
        advance(&l, FORGET_AFTER + MINUTE);
        // Starts over: three more tries before a 1-minute lock.
        for _ in 0..3 {
            fail(&l, "juan").expect("allowed");
        }
        assert!(fail(&l, "juan").expect_err("locked") <= MINUTE);
    }

    #[test]
    fn message_rounds_up_to_minutes() {
        assert!(too_many_message(Duration::from_secs(61)).contains("2 minutes"));
        assert!(too_many_message(Duration::from_secs(5)).contains("1 minute "));
    }
}
