import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, GraduationCap, IdCard, Lock, Mail, School, User } from "lucide-react";
import { SelectField, TextField } from "../../components/TextField/TextField";
import { isEmail, MIN_PASSWORD_LENGTH, passwordStrength, type FieldErrors } from "./validation";
import { api } from "../../lib/api";
import { usePreferences } from "../../lib/preferences";
import { toast } from "../../components/Toast/Toast";
import LegalModal, { type LegalKind } from "../Legal/LegalModal";
import "./Auth.css";

type Field = "firstName" | "middleName" | "lastName" | "email" | "school" | "yearLevel" | "studentId" | "password" | "confirmPassword" | "agree";

const initialValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  school: "",
  yearLevel: "",
  studentId: "",
  password: "",
  confirmPassword: "",
};

// Same values as Settings › Account.
const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"].map((y) => ({ value: y, label: y }));

export default function Register() {
  const navigate = useNavigate();
  const { reload: reloadPreferences } = usePreferences();
  const [serverError, setServerError] = useState<string | null>(null);
  const [legal, setLegal] = useState<LegalKind | null>(null);
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
    if (!values.firstName.trim()) next.firstName = "Enter your first name.";
    if (!values.lastName.trim()) next.lastName = "Enter your last name.";
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
    setServerError(null);
    try {
      await api.register({
        firstName: values.firstName,
        middleName: values.middleName.trim() || null,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        university: values.school,
        yearLevel: values.yearLevel,
        studentId: values.studentId.trim() || null,
        remember: true,
      });
      await reloadPreferences();
      toast.created("Account created", `Welcome to NurSet, ${values.firstName.trim()}!`);
      navigate("/", { replace: true });
    } catch (err) {
      const message = String(err);
      if (message.includes("email")) setErrors({ email: message });
      else setServerError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form-wrap">
      <header className="auth-header">
        <h2>Create your account</h2>
        <p>Set up NurSet and get ready for your next duty.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <TextField
          label="First name"
          icon={User}
          placeholder="Juan"
          autoComplete="given-name"
          autoFocus
          value={values.firstName}
          error={errors.firstName}
          onChange={(e) => update("firstName", e.target.value)}
        />

        <div className="auth-row auth-row--even">
          <TextField
            label="Middle name (optional)"
            placeholder="Santos"
            autoComplete="additional-name"
            value={values.middleName}
            error={errors.middleName}
            onChange={(e) => update("middleName", e.target.value)}
          />
          <TextField
            label="Last name"
            placeholder="Dela Cruz"
            autoComplete="family-name"
            value={values.lastName}
            error={errors.lastName}
            onChange={(e) => update("lastName", e.target.value)}
          />
        </div>

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
          label="Student ID (optional)"
          icon={IdCard}
          placeholder="e.g. 2021-00123"
          hint="Lets your clinical instructor add you to their group, and you can sign in with it."
          value={values.studentId}
          error={errors.studentId}
          onChange={(e) => update("studentId", e.target.value)}
        />

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
              I agree to the{" "}
              <button type="button" className="auth-inline-link" onClick={(e) => (e.preventDefault(), setLegal("terms"))}>
                Terms of Use
              </button>{" "}
              and{" "}
              <button type="button" className="auth-inline-link" onClick={(e) => (e.preventDefault(), setLegal("privacy"))}>
                Privacy Policy
              </button>
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

      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} onSwitch={setLegal} />}

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
