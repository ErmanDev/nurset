import { useEffect, useRef, useState, type DragEvent } from "react";
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

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Badge text and colour for the picked file's type. */
function fileKind(name: string): { label: string; tone: string } {
  const ext = extensionOf(name);
  if (ext === "pdf") return { label: "PDF", tone: "red" };
  if (ext === "doc" || ext === "docx") return { label: "DOCX", tone: "blue" };
  if (ext === "ppt" || ext === "pptx") return { label: "PPT", tone: "amber" };
  if (IMAGE_EXTENSIONS.includes(ext)) return { label: ext === "jpeg" ? "JPG" : ext.toUpperCase(), tone: "green" };
  return { label: ext.toUpperCase() || "FILE", tone: "gray" };
}

/** Object URL for an image file (revoked when the file changes), else null. */
function useImagePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !IMAGE_EXTENSIONS.includes(extensionOf(file.name))) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/** Drag-and-drop area with a "browse" fallback. Holds a single file. */
export default function FileDropzone({ file, onChange, accept, hint, error, large, subtitle }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = useImagePreview(large ? null : file);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  }

  const browse = () => input.current?.click();

  if (file && !large) {
    const kind = fileKind(file.name);
    return (
      <div className={`dropzone-picked${preview ? " has-preview" : ""}`}>
        {preview && (
          <div className="dropzone-preview">
            <img src={preview} alt={`Preview of ${file.name}`} />
          </div>
        )}
        <div className="dropzone-file">
          <span className={`dropzone-file-icon dropzone-kind--${kind.tone}`}>
            {preview ? <FileText size={18} /> : <span className="dropzone-kind-label">{kind.label}</span>}
          </span>
          <div className="dropzone-file-text">
            <strong title={file.name}>{file.name}</strong>
            <span>
              {kind.label} · {formatBytes(file.size)}
            </span>
          </div>
          <button type="button" className="dropzone-remove" onClick={() => onChange(null)} aria-label="Remove file">
            <X size={16} />
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
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
