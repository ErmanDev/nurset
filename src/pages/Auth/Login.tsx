import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { TextField } from "../../components/TextField/TextField";
import type { FieldErrors } from "./validation";
import { api } from "../../lib/api";
import { usePreferences } from "../../lib/preferences";
import "./Auth.css";

type Field = "identifier" | "password";

export default function Login() {
  const navigate = useNavigate();
  const { reload: reloadPreferences } = usePreferences();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Remembers the last choice on this computer (default: on).
  const [remember, setRemember] = useState(() => {
    try {
      return localStorage.getItem("nurset.keepSignedIn") !== "0";
    } catch {
      return true;
    }
  });

  function changeRemember(value: boolean) {
    setRemember(value);
    try {
      localStorage.setItem("nurset.keepSignedIn", value ? "1" : "0");
    } catch {
      /* storage unavailable: the choice just isn't remembered */
    }
  }
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!identifier.trim()) next.identifier = "Enter your clinical instructor or student email.";
    if (!password) next.password = "Enter your password.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const profile = await api.signIn(identifier, password, remember);
      await reloadPreferences(); // the new account's theme, accent, ...
      navigate(profile.accountType === "clinical_instructor" ? "/ci" : "/", { replace: true });
    } catch (err) {
      const message = String(err);
      // Wrong credentials belong under the password; other problems (database down) at the top.
      setErrors(message.includes("password") ? { password: message } : { identifier: message });
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form-wrap">
      <header className="auth-header">
        <h2>Welcome back</h2>
        <p>Sign in to see your duties and tasks.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="CI email or student email"
          icon={Mail}
          placeholder="you@school.edu"
          autoComplete="username"
          autoFocus
          value={identifier}
          error={errors.identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setErrors((er) => ({ ...er, identifier: undefined }));
          }}
        />

        <TextField
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((er) => ({ ...er, password: undefined }));
          }}
        />

        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={(e) => changeRemember(e.target.checked)} />
          <span>
            Keep me signed in
            <small className="auth-check-hint">
              {remember
                ? "Stay signed in on this computer for 30 days, even after closing NurSet."
                : "You'll be signed out when you close NurSet. Use this on shared computers."}
            </small>
          </span>
        </label>

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </form>

      <p className="auth-switch">
        New to NurSet? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
