import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import Modal from "../../components/Modal/Modal";
import SelectMenu from "../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import { formatBytes } from "../../components/FileDropzone/FileDropzone";
import { api } from "../../lib/api";
import type { Material, MaterialKind } from "../../lib/types";
import { kindForFile, kindLabels } from "./shared";
import { toast } from "../../components/Toast/Toast";

interface Props {
  /** New upload… */
  file: File | null;
  /** …or editing an existing one. */
  material: Material | null;
  onClose: () => void;
  onSaved: (m: Material) => void;
}

const kindOptions = (["pdf_notes", "presentation", "reviewer"] as MaterialKind[]).map((k) => ({
  value: k,
  label: kindLabels[k],
}));

export default function MaterialFormModal({ file, material, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(material?.title ?? file?.name.replace(/\.[^.]+$/, "") ?? "");
  const [kind, setKind] = useState<MaterialKind>(material?.kind ?? (file ? kindForFile(file.name) : "pdf_notes"));
  const [description, setDescription] = useState(material?.description ?? "");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Give this material a title.");
      return;
    }
    const details = { title: title.trim(), kind, description: description || null };
    setSaving(true);
    setServerError(null);
    try {
      const saved = material ? await api.updateMaterial(material.id, details) : await api.uploadMaterial(file!, details);
      if (material) toast.updated("Material updated", `Changes to “${saved.title}” were saved.`);
      else toast.created("Material uploaded", `“${saved.title}” was added to your Learning Hub.`);
      onSaved(saved);
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={material ? "Edit material" : "New material"}
      title={material ? "Edit Details" : "Material Details"}
      width={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="material-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : material ? "Save changes" : "Upload"}
          </button>
        </>
      }
    >
      <form id="material-form" className="form-stack form-lavender" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        {file && (
          <div className="dropzone-file">
            <span className="dropzone-file-icon">
              <FileText size={18} />
            </span>
            <div className="dropzone-file-text">
              <strong title={file.name}>{file.name}</strong>
              <span>{formatBytes(file.size)}</span>
            </div>
          </div>
        )}
        <TextField
          label="Title"
          placeholder="e.g. Fundamentals of Nursing – Study Notes"
          autoFocus
          value={title}
          error={titleError}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(undefined);
          }}
        />
        <SelectMenu label="Type" options={kindOptions} value={kind} onChange={(v) => setKind(v as MaterialKind)} />
        <TextAreaField
          label="Description (optional)"
          placeholder="What does this material cover?"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
}
