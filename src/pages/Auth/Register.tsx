import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, GraduationCap, Lock, Mail, School, User } from "lucide-react";
import { SelectField, TextField } from "../../components/TextField/TextField";
import { isEmail, MIN_PASSWORD_LENGTH, passwordStrength, type FieldErrors } from "./validation";
import "./Auth.css";

type Field = "fullName" | "email" | "school" | "yearLevel" | "password" | "confirmPassword" | "agree";

const initialValues = {
  fullName: "",
  email: "",
  school: "",
  yearLevel: "",
  password: "",
  confirmPassword: "",
};

const yearLevels = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
];

export default function Register() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);

  const strength = passwordStrength(values.password);

  function update(field: keyof typeof initialValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  }

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!values.fullName.trim()) next.fullName = "Enter your full name.";
    if (!values.email.trim()) next.email = "Enter your email.";
    else if (!isEmail(values.email)) next.email = "Enter a valid email address.";
    if (!values.school.trim()) next.school = "Enter your school.";
    if (!values.yearLevel) next.yearLevel = "Select your year level.";
    if (values.password.length < MIN_PASSWORD_LENGTH)
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (!values.confirmPassword) next.confirmPassword = "Re-enter your password.";
    else if (values.confirmPassword !== values.password)
      next.confirmPassword = "Passwords don't match.";
    if (!agree) next.agree = "Please accept the terms to continue.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    // TODO(auth): replace with a Tauri `register` command (hash password in Rust, save profile).
    await new Promise((resolve) => setTimeout(resolve, 400));
    navigate("/", { replace: true });
  }

  return (
    <div className="auth-form-wrap">
      <header className="auth-header">
        <h2>Create your account</h2>
        <p>Set up NurSet and get ready for your next duty.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Full name"
          icon={User}
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          autoFocus
          value={values.fullName}
          error={errors.fullName}
          onChange={(e) => update("fullName", e.target.value)}
        />

        <TextField
          label="Email"
          icon={Mail}
          type="email"
          placeholder="you@school.edu"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => update("email", e.target.value)}
        />

        <div className="auth-row">
          <TextField
            label="School"
            icon={School}
            placeholder="Your nursing school"
            autoComplete="organization"
            value={values.school}
            error={errors.school}
            onChange={(e) => update("school", e.target.value)}
          />
          <SelectField
            label="Year level"
            icon={GraduationCap}
            placeholder="Select"
            required
            options={yearLevels}
            value={values.yearLevel}
            error={errors.yearLevel}
            onChange={(e) => update("yearLevel", e.target.value)}
          />
        </div>

        <TextField
          label="Password"
          icon={Lock}
          type="password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
          value={values.password}
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
          onChange={(e) => update("password", e.target.value)}
        />

        <TextField
          label="Confirm password"
          icon={Lock}
          type="password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
        />

        <div>
          <label className="auth-check">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked);
                setErrors((er) => ({ ...er, agree: undefined }));
              }}
            />
            <span>
              I agree to the <span className="auth-inline-link">Terms of Use</span> and{" "}
              <span className="auth-inline-link">Privacy Policy</span>
            </span>
          </label>
          {errors.agree && (
            <p className="field-error" role="alert" style={{ marginTop: 4 }}>
              {errors.agree}
            </p>
          )}
        </div>

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
