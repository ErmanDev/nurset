import { useRef, useState, type DragEvent } from "react";
import { CloudUpload, FileText, X } from "lucide-react";
import "./FileDropzone.css";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Value for the file input's `accept` attribute, e.g. ".pdf,.docx". */
  accept: string;
  /** Short line under the prompt, e.g. "PDF, DOCX · up to 25 MB". */
  hint: string;
  error?: string;
  /**
   * Large standalone layout with a "Browse Files" button (Upload Materials).
   * It never shows the picked file; the parent handles it.
   */
  large?: boolean;
  subtitle?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drag-and-drop area with a "browse" fallback. Holds a single file. */
export default function FileDropzone({ file, onChange, accept, hint, error, large, subtitle }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  }

  const browse = () => input.current?.click();

  if (file && !large) {
    return (
      <div className="dropzone-file">
        <span className="dropzone-file-icon">
          <FileText size={18} />
        </span>
        <div className="dropzone-file-text">
          <strong title={file.name}>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
        </div>
        <button type="button" className="dropzone-remove" onClick={() => onChange(null)} aria-label="Remove file">
          <X size={16} />
        </button>
      </div>
    );
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept={accept}
      hidden
      onChange={(e) => {
        onChange(e.target.files?.[0] ?? null);
        e.target.value = ""; // allow re-selecting the same file
      }}
    />
  );

  const dragProps = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      // ignore leave events fired when moving over child elements
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
    },
    onDrop: handleDrop,
  };

  if (large) {
    return (
      <>
        <div className={`dropzone dropzone--large${dragging ? " is-dragging" : ""}${error ? " has-error" : ""}`} {...dragProps}>
          <span className="dropzone-icon dropzone-icon--large">
            <CloudUpload size={26} />
          </span>
          <p className="dropzone-title">{dragging ? "Drop your file here" : "Drag and drop your files here"}</p>
          {subtitle && <p className="dropzone-sub">{subtitle}</p>}
          <button type="button" className="btn btn-primary dropzone-browse-btn" onClick={browse}>
            Browse Files
          </button>
          <p className="dropzone-hint">{hint}</p>
          {fileInput}
        </div>
        {error && <p className="field-error">{error}</p>}
      </>
    );
  }

  return (
    <>
      <div
        className={`dropzone${dragging ? " is-dragging" : ""}${error ? " has-error" : ""}`}
        role="button"
        tabIndex={0}
        onClick={browse}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && browse()}
        {...dragProps}
      >
        <span className="dropzone-icon">
          <CloudUpload size={22} />
        </span>
        <p className="dropzone-title">{dragging ? "Drop your file here" : "Drag and drop your files here"}</p>
        <p className="dropzone-sub">
          or <span className="dropzone-browse">browse files</span>
        </p>
        <p className="dropzone-hint">{hint}</p>
        {fileInput}
      </div>
      {error && <p className="field-error">{error}</p>}
    </>
  );
}
