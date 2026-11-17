import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, CircleCheck, KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import { TextField } from "../../components/TextField/TextField";
import CodeInput from "./CodeInput";
import { isEmail, MIN_PASSWORD_LENGTH, passwordStrength } from "./validation";
import "./Auth.css";

type Step = "email" | "code" | "password" | "done";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/** "regiel.cagol@example.com" -> "re•••••••@example.com" */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
}

// TODO(auth): replace the simulated steps with real calls once sign-in exists:
//   sendResetCode(email) -> verifyResetCode(email, code) -> resetPassword(token, password)
const simulate = () => new Promise((resolve) => setTimeout(resolve, 500));

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { email?: string } | null)?.email ?? "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(prefill);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return setErrors({ email: "Enter the email you signed up with." });
    if (!isEmail(email)) return setErrors({ email: "Enter a valid email address." });
    setErrors({});
    setBusy(true);
    await simulate();
    setBusy(false);
    setCode("");
    setCooldown(RESEND_SECONDS);
    setStep("code");
  }

  async function resend() {
    setBusy(true);
    await simulate();
    setBusy(false);
    setCode("");
    setResent(true);
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d+$/.test(code) || code.length !== CODE_LENGTH) {
      return setErrors({ code: `Enter all ${CODE_LENGTH} digits.` });
    }
    setErrors({});
    setBusy(true);
    await simulate();
    setBusy(false);
    setStep("password");
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (!confirm) next.confirm = "Re-enter your new password.";
    else if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    await simulate();
    setBusy(false);
    setPassword("");
    setConfirm("");
    setStep("done");
  }

  const stepIndex = { email: 0, code: 1, password: 2, done: 3 }[step];
  const strength = passwordStrength(password);

  return (
    <div className="auth-form-wrap">
      {step !== "done" && (
        <div className="fp-steps" aria-label={`Step ${stepIndex + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= stepIndex ? "is-done" : ""} />
          ))}
        </div>
      )}

      {step === "email" && (
        <>
          <header className="auth-header">
            <span className="fp-icon">
              <KeyRound size={22} />
            </span>
            <h2>Forgot your password?</h2>
            <p>Enter your email and we'll send you a {CODE_LENGTH}-digit code to reset it.</p>
          </header>
          <form className="auth-form" onSubmit={sendCode} noValidate>
            <TextField
              label="Email"
              icon={Mail}
              type="email"
              placeholder="you@school.edu"
              autoComplete="email"
              autoFocus
              value={email}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
              }}
            />
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Sending code…" : "Send reset code"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <header className="auth-header">
            <span className="fp-icon">
              <MailCheck size={22} />
            </span>
            <h2>Check your email</h2>
            <p>
              We sent a {CODE_LENGTH}-digit code to <strong>{maskEmail(email.trim())}</strong>. Enter it below to
              continue.
            </p>
          </header>
          <form className="auth-form" onSubmit={verifyCode} noValidate>
            <div className="fp-code">
              <CodeInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setErrors({});
                }}
                length={CODE_LENGTH}
                invalid={Boolean(errors.code)}
                autoFocus
              />
              {errors.code && <p className="field-error">{errors.code}</p>}
            </div>
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify code"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="auth-switch">
            {resent && cooldown > 0 ? "New code sent. " : "Didn't get it? "}
            {cooldown > 0 ? (
              <span className="fp-muted">Resend in {cooldown}s</span>
            ) : (
              <button type="button" className="fp-link" onClick={resend} disabled={busy}>
                Resend code
              </button>
            )}
            {" · "}
            <button type="button" className="fp-link" onClick={() => setStep("email")}>
              Change email
            </button>
          </p>
        </>
      )}

      {step === "password" && (
        <>
          <header className="auth-header">
            <span className="fp-icon">
              <Lock size={22} />
            </span>
            <h2>Create a new password</h2>
            <p>Choose a strong password you haven't used before.</p>
          </header>
          <form className="auth-form" onSubmit={savePassword} noValidate>
            <TextField
              label="New password"
              icon={Lock}
              type="password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              autoFocus
              value={password}
              error={errors.password}
              hint={
                strength.score > 0 && (
                  <div className={`strength strength--${strength.score}`}>
                    <span className="strength-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>{strength.label} password</span>
                  </div>
                )
              }
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((er) => ({ ...er, password: undefined }));
              }}
            />
            <TextField
              label="Confirm new password"
              icon={Lock}
              type="password"
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              value={confirm}
              error={errors.confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((er) => ({ ...er, confirm: undefined }));
              }}
            />
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Saving…" : "Reset password"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </>
      )}

      {step === "done" && (
        <div className="fp-done">
          <span className="fp-done-icon">
            <CircleCheck size={34} />
          </span>
          <h2>Password reset!</h2>
          <p>Your password has been updated. You can now sign in with your new password.</p>
          <button type="button" className="auth-submit" onClick={() => navigate("/login", { replace: true })}>
            Back to sign in <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step !== "done" && (
        <p className="auth-switch">
          <Link to="/login" className="fp-back">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </p>
      )}
    </div>
  );
}
