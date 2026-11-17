import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import Modal from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { api } from "../../lib/api";
import type { GroupSummary } from "../../lib/types";
import { GROUP_COLORS } from "./shared";

interface Props {
  /** Present when editing. */
  group?: GroupSummary;
  onClose: () => void;
  onSaved: (group: GroupSummary) => void;
}

export default function GroupFormModal({ group, onClose, onSaved }: Props) {
  const [name, setName] = useState(group?.name ?? "");
  const [area, setArea] = useState(group?.area ?? "");
  const [hospital, setHospital] = useState(group?.hospital ?? "");
  const [term, setTerm] = useState(group?.term ?? "");
  const [color, setColor] = useState(group?.color ?? "blue");
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setNameError("Give the group a name.");
    const input = { name, area: area || null, hospital: hospital || null, term: term || null, color };
    setSaving(true);
    setServerError(null);
    try {
      onSaved(group ? await api.updateGroup(group.id, input) : await api.createGroup(input));
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={group ? "Edit group" : "New group"}
      title={group ? "Edit Clinical Group" : "Create Clinical Group"}
      width={500}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="group-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : group ? "Save changes" : "Create group"}
          </button>
        </>
      }
    >
      <form id="group-form" className="form-stack form-lavender" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <TextField
          label="Group name"
          placeholder="e.g. BSN 4-A · Group 1"
          autoFocus
          value={name}
          error={nameError}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
        />
        <div className="form-row-2">
          <TextField label="Clinical area (optional)" placeholder="e.g. Medical Ward" value={area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Term (optional)" placeholder="e.g. 1st Sem 2026-2027" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <TextField
          label="Hospital / facility (optional)"
          placeholder="e.g. Sanitarium Medical Center"
          value={hospital}
          onChange={(e) => setHospital(e.target.value)}
        />
        <div className="field">
          <span className="field-label">Color</span>
          <div className="ci-swatches" role="radiogroup" aria-label="Group color">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className={`ci-swatch ci-tone--${c}${color === c ? " is-active" : ""}`}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
