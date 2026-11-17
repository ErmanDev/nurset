import { useState, type FormEvent } from "react";
import Modal from "../../components/Modal/Modal";
import FileDropzone from "../../components/FileDropzone/FileDropzone";
import { SelectField, TextAreaField, TextField } from "../../components/TextField/TextField";
import { api } from "../../lib/api";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png";
const MAX_BYTES = 25 * 1024 * 1024;

const documentTypes = [
  "Medical Clearance",
  "Drug Study",
  "Nursing Care Plan",
  "Case Study",
  "Clinical Duty Logbook",
  "Academic Record",
  "Certificate",
  "Other",
].map((t) => ({ value: t, label: t }));

type Field = "file" | "documentType" | "title";

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDocumentModal({ open, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(field: Field) {
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function pickFile(next: File | null) {
    clearError("file");
    if (next) {
      const ext = next.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPT.split(",").includes(`.${ext}`)) {
        setErrors((e) => ({ ...e, file: "Unsupported file type. Use PDF, DOC, PPT, JPG, or PNG." }));
        return;
      }
      if (next.size > MAX_BYTES) {
        setErrors((e) => ({ ...e, file: "File is larger than 25 MB." }));
        return;
      }
      // Suggest a title from the file name if none was typed yet.
      if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
    setFile(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    if (!file) next.file = "Choose a file to upload.";
    if (!documentType) next.documentType = "Select a document type.";
    if (!title.trim()) next.title = "Enter a document title.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !file) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await api.uploadDocument(file, { documentType, title: title.trim(), notes });
      onUploaded();
    } catch (err) {
      setServerError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Document Information"
      subtitle="Provide details about your submission."
      width={440}
      hideClose
    >
      <form className="upload-form" onSubmit={handleSubmit} noValidate>
        <FileDropzone
          file={file}
          onChange={pickFile}
          accept={ACCEPT}
          hint="PDF, DOC, DOCX, PPT, JPG, PNG · up to 25 MB"
          error={errors.file}
        />

        {serverError && <div className="alert-error">{serverError}</div>}

        <SelectField
          label="Document Type"
          placeholder="Select document type"
          required
          options={documentTypes}
          value={documentType}
          error={errors.documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
            clearError("documentType");
          }}
        />

        <TextField
          label="Document Title"
          placeholder="Document title"
          value={title}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearError("title");
          }}
        />

        <TextAreaField
          label="Submission Notes"
          placeholder="Add any relevant notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="upload-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Uploading…" : "Submit Document"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            data-modal-cancel
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
