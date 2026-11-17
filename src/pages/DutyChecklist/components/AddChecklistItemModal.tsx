import { useState, type FormEvent } from "react";
import Modal from "../../../components/Modal/Modal";
import SelectMenu from "../../../components/SelectMenu/SelectMenu";
import { TextField } from "../../../components/TextField/TextField";

export type ChecklistCategory = "bag" | "rotation" | "requirement" | "other";

const allCategories: { value: ChecklistCategory; label: string }[] = [
  { value: "bag", label: "Duty Bag" },
  { value: "rotation", label: "Rotation Preparation" },
  { value: "requirement", label: "Requirement" },
  { value: "other", label: "Other" },
];

interface Props {
  initialCategory: ChecklistCategory;
  /** Categories that can't be used right now (e.g. no duty selected → no bag). */
  unavailable?: ChecklistCategory[];
  onClose: () => void;
  onSubmit: (label: string, category: ChecklistCategory) => Promise<void>;
}

export default function AddChecklistItemModal({ initialCategory, unavailable = [], onClose, onSubmit }: Props) {
  const categories = allCategories.filter((c) => !unavailable.includes(c.value));
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>(
    categories.some((c) => c.value === initialCategory) ? initialCategory : categories[0]?.value ?? "other",
  );
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("Enter an item name.");
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await onSubmit(label.trim(), category);
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Customize your list"
      title="Add Checklist Items"
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="checklist-item-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add Item"}
          </button>
        </>
      }
    >
      <form id="checklist-item-form" className="form-stack prep-item-form" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <TextField
          label="Item name"
          placeholder="Enter a preparation item"
          autoFocus
          value={label}
          error={error}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(undefined);
          }}
        />
        <SelectMenu
          label="Category"
          options={categories}
          value={category}
          onChange={(v) => setCategory(v as ChecklistCategory)}
        />
        {category === "requirement" && (
          <p className="field-hint">Added to Requirements, due on the selected duty's date.</p>
        )}
      </form>
    </Modal>
  );
}
