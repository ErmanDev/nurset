import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { formatBytes } from "../../components/FileDropzone/FileDropzone";
import type { Material, MaterialKind } from "../../lib/types";

/**
 * "← Title / subtitle" header used by the Quick Links sub-pages.
 * `back`: a route, "history" (previous page), or null for no back arrow.
 */
export function QlHeader({
  title,
  subtitle,
  back = "/quick-links",
}: {
  title: string;
  subtitle: string;
  back?: string | null;
}) {
  const navigate = useNavigate();
  return (
    <header className="ql-subhead">
      {back === "history" ? (
        <button type="button" className="ql-back" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
      ) : (
        back && (
          <Link to={back} className="ql-back" aria-label="Back to Quick Links">
            <ArrowLeft size={18} />
          </Link>
        )
      )}
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

export const kindLabels: Record<MaterialKind, string> = {
  pdf_notes: "PDF Notes",
  presentation: "Presentation",
  reviewer: "Reviewer",
  handbook: "Handbook",
};

export const MATERIAL_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png";
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

export function extensionOf(name: string | null): string {
  return name?.split(".").pop()?.toUpperCase() ?? "";
}

/** Best material type for a file name. */
export function kindForFile(name: string): MaterialKind {
  const ext = extensionOf(name);
  return ext === "PPT" || ext === "PPTX" ? "presentation" : "pdf_notes";
}

/** "PDF · 24 pages", "PPT · 18 slides", or "DOCX · 2.4 MB" for uploads. */
export function materialMeta(m: Material): string {
  if (m.fileName) {
    const size = m.fileSize ? ` · ${formatBytes(m.fileSize)}` : "";
    return `${extensionOf(m.fileName)}${size}`;
  }
  if (m.kind === "presentation") return `PPT · ${m.pageCount ?? 0} slides`;
  return `PDF · ${m.pageCount ?? 0} pages`;
}

/** "PDF document · 2.4 MB" */
export function fileDescription(m: Material): string {
  const ext = extensionOf(m.fileName);
  const kind = ext === "PPT" || ext === "PPTX" ? "Presentation" : ext === "JPG" || ext === "JPEG" || ext === "PNG" ? "Image" : `${ext} document`;
  return m.fileSize ? `${kind} · ${formatBytes(m.fileSize)}` : kind;
}

/** Validation shared by the upload flows. */
export function checkMaterialFile(file: File): string | null {
  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (!MATERIAL_ACCEPT.split(",").includes(ext)) return "Unsupported file type. Use PDF, DOCX, PPTX, JPG, or PNG.";
  if (file.size > MATERIAL_MAX_BYTES) return "File is larger than 20 MB.";
  return null;
}
