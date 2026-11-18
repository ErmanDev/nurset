import { useRef, useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { api } from "../../../lib/api";
import { notifyProfileChanged } from "../../../lib/preferences";
import { useAsync } from "../../../hooks/useAsync";
import type { Profile } from "../../../lib/types";
import Avatar from "../../../components/Avatar/Avatar";
import Modal from "../../../components/Modal/Modal";
import SelectMenu from "../../../components/SelectMenu/SelectMenu";
import { TextField } from "../../../components/TextField/TextField";
import { SectionHeader } from "./shared";
import { ChangePasswordModal } from "./security";
import { toast } from "../../../components/Toast/Toast";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

/** Shrinks an image file to a square-ish JPEG data URL (max 256px) for the profile picture. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h); // center-crop
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function AccountSection() {
  const { data: profile, setData, error } = useAsync(api.getProfile);
  const [editing, setEditing] = useState<"profile" | "email" | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function changePicture(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage("Choose an image file (PNG or JPG).");
    try {
      const updated = await api.setAvatar(await toAvatarDataUrl(file));
      setData(updated);
      notifyProfileChanged();
      toast.updated("Profile picture updated");
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function removePicture() {
    try {
      setData(await api.setAvatar(null));
      notifyProfileChanged();
      toast.deleted("Profile picture removed");
    } catch (err) {
      setMessage(String(err));
    }
  }

  const isInstructor = profile?.accountType === "clinical_instructor";
  const info: [string, string | null | undefined][] = [
    ["Full name", profile?.fullName],
    ["Email address", profile?.email],
    [isInstructor ? "School / institution" : "University", profile?.university],
    ...(isInstructor
      ? []
      : ([
          ["Nursing year level", profile?.yearLevel],
          ["Student ID", profile?.studentId],
        ] as [string, string | null | undefined][])),
    ["Account type", isInstructor ? "Clinical Instructor" : profile?.role],
  ];

  return (
    <div className="st-section">
      <SectionHeader title="Account" subtitle="Manage your profile information and connected accounts." />
      {(error || message) && <div className="alert-error">{error ?? message}</div>}

      <div className="st-profile-card">
        <button
          type="button"
          className="st-profile-avatar"
          onClick={() => picker.current?.click()}
          disabled={!profile}
          title={profile?.avatarData ? "Change profile picture" : "Add a profile picture"}
          aria-label={profile?.avatarData ? "Change profile picture" : "Add a profile picture"}
        >
          <Avatar profile={profile} size={72} alwaysShow />
          <span className="st-avatar-camera" aria-hidden="true">
            <Camera size={14} />
          </span>
        </button>
        <div className="st-profile-text">
          <strong>{profile?.fullName ?? "Your name"}</strong>
          <span>{profile?.email ?? "No email added"}</span>
          <button className="text-link" onClick={() => setEditing("profile")}>
            Edit Profile
          </button>
        </div>
        <div className="st-profile-actions">
          <button className="btn btn-secondary" onClick={() => picker.current?.click()} disabled={!profile}>
            {profile?.avatarData ? "Change Picture" : "Upload Profile Picture"}
          </button>
          {profile?.avatarData && (
            <button className="text-link" onClick={removePicture}>
              Remove picture
            </button>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            void changePicture(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="st-block">
        <div className="st-block-head">
          <div>
            <h3>Personal Information</h3>
            <p className="st-muted">Your details are only visible to you.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setEditing("profile")}>
            Edit Profile
          </button>
        </div>
        <dl className="st-info-grid">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="st-block">
        <h3>Sign-in &amp; Security</h3>
        <div className="st-row">
          <div>
            <strong>Password</strong>
            <span>Used with your email{profile?.studentId ? " or student ID" : ""} to sign in</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setChangingPassword(true)}>
            Change Password
          </button>
        </div>
        <div className="st-row">
          <div>
            <strong>Email address</strong>
            <span>{profile?.email ?? "No email added"}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setEditing("email")}>
            Update Email
          </button>
        </div>
      </div>

      {editing && profile !== undefined && (
        <ProfileFormModal
          profile={profile}
          focusEmail={editing === "email"}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setData(p);
            setEditing(null);
            notifyProfileChanged();
            toast.updated("Profile updated", "Your account details were saved.");
          }}
        />
      )}
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  );
}

function ProfileFormModal({
  profile,
  focusEmail,
  onClose,
  onSaved,
}: {
  profile: Profile | null;
  focusEmail: boolean;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [values, setValues] = useState({
    fullName: profile?.fullName ?? "",
    displayName: profile?.displayName ?? "",
    email: profile?.email ?? "",
    university: profile?.university ?? "",
    studentId: profile?.studentId ?? "",
    yearLevel: profile?.yearLevel ?? "",
  });
  const [errors, setErrors] = useState<{ fullName?: string; displayName?: string; email?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.fullName.trim()) next.fullName = "Enter your full name.";
    if (!values.displayName.trim()) next.displayName = "Enter what we should call you.";
    if (!values.email.trim()) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setServerError(null);
    try {
      onSaved(
        await api.updateProfile({
          fullName: values.fullName,
          displayName: values.displayName,
          email: values.email || null,
          university: values.university || null,
          studentId: values.studentId || null,
          yearLevel: values.yearLevel || null,
        }),
      );
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  const yearOptions = [{ value: "", label: "Not set" }, ...YEAR_LEVELS.map((y) => ({ value: y, label: y }))];

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Account"
      title="Edit Profile"
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="profile-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="profile-form" className="form-stack form-lavender" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <div className="form-row-2">
          <TextField
            label="Full name"
            value={values.fullName}
            error={errors.fullName}
            autoFocus={!focusEmail}
            onChange={(e) => set("fullName")(e.target.value)}
          />
          <TextField
            label="Display name"
            hint="Used in greetings, e.g. “Good morning, Regiel!”"
            value={values.displayName}
            error={errors.displayName}
            onChange={(e) => set("displayName")(e.target.value)}
          />
        </div>
        <TextField
          label="Email address"
          type="email"
          placeholder="you@school.edu"
          value={values.email}
          error={errors.email}
          autoFocus={focusEmail}
          onChange={(e) => set("email")(e.target.value)}
        />
        <TextField
          label={profile?.accountType === "clinical_instructor" ? "School / institution" : "University"}
          value={values.university}
          onChange={(e) => set("university")(e.target.value)}
        />
        {profile?.accountType !== "clinical_instructor" && (
          <div className="form-row-2">
            <SelectMenu label="Nursing year level" options={yearOptions} value={values.yearLevel} onChange={set("yearLevel")} />
            <TextField label="Student ID" value={values.studentId} onChange={(e) => set("studentId")(e.target.value)} />
          </div>
        )}
      </form>
    </Modal>
  );
}
