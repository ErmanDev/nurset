import { useState } from "react";
import { CircleCheck, ExternalLink, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import type { Material } from "../../lib/types";
import FileDropzone from "../../components/FileDropzone/FileDropzone";
import RowMenu from "../../components/RowMenu/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import MaterialFormModal from "./MaterialFormModal";
import { MATERIAL_ACCEPT, QlHeader, checkMaterialFile, fileDescription } from "./shared";
import { toast } from "../../components/Toast/Toast";
import "./QuickLinks.css";

const loadMine = async () => (await api.listMaterials()).filter((m) => m.isMine);

const guidelines = [
  { title: "Keep files under 20 MB", text: "Large files take longer to save and open" },
  { title: "Use supported file formats", text: "PDF, DOCX, PPTX, JPG, and PNG files are accepted" },
  { title: "Share appropriate materials", text: "Only upload study resources you're allowed to use and share" },
];

export default function UploadMaterials() {
  const { data: mine, error, reload } = useAsync(loadMine);
  const [pending, setPending] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function pick(file: File | null) {
    if (!file) return;
    const problem = checkMaterialFile(file);
    setFileError(problem ?? undefined);
    if (!problem) setPending(file);
  }

  return (
    <div className="ql">
      <QlHeader title="Upload Materials" subtitle="Add your nursing notes and learning materials to your library" />

      <div className="ql-two-col">
        <div className="ql-col">
          <FileDropzone
            large
            file={null}
            onChange={pick}
            accept={MATERIAL_ACCEPT}
            subtitle="Select files from your device to add to your Learning Hub"
            hint="PDF, DOCX, PPTX, JPG, PNG · Max 20 MB per file"
            error={fileError}
          />

          <section>
            <h2 className="ql-section-title ql-section-title--sm">My Uploaded Materials</h2>
            {(error || actionError) && <div className="alert-error">{error ?? actionError}</div>}
            {!mine && !error && <div className="skeleton" style={{ height: 120 }} />}
            {mine && mine.length === 0 && (
              <div className="card ql-empty">
                <p className="empty-text">Nothing uploaded yet. Drop a file above to get started.</p>
              </div>
            )}
            <div className="ql-list">
              {mine?.map((m) => (
                <article key={m.id} className="card um-row">
                  <span className="um-icon">
                    <FileText size={18} />
                  </span>
                  <div className="um-text">
                    <strong>{m.title}</strong>
                    <small>{fileDescription(m)}</small>
                    <span className="um-status">
                      <CircleCheck size={12} /> In your Learning Hub
                    </span>
                  </div>
                  <button
                    className="um-view"
                    onClick={() => api.openMaterial(m.id).catch((err) => setActionError(String(err)))}
                  >
                    <ExternalLink size={16} />
                    View
                  </button>
                  <RowMenu label="Material actions" onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
                </article>
              ))}
            </div>
            <p className="ql-footnote">
              Only upload study materials you have permission to use. Never upload files containing identifiable patient
              information.
            </p>
          </section>
        </div>

        <aside className="ql-col">
          <section className="card ql-side">
            <h3>Upload Guidelines</h3>
            {guidelines.map((g) => (
              <div key={g.title} className="ql-guide">
                <strong>{g.title}</strong>
                <span>{g.text}</span>
              </div>
            ))}
            <p className="ql-side-note">Protect patient privacy. Remove identifying details.</p>
          </section>
        </aside>
      </div>

      {(pending || editing) && (
        <MaterialFormModal
          file={pending}
          material={editing}
          onClose={() => {
            setPending(null);
            setEditing(null);
          }}
          onSaved={() => {
            setPending(null);
            setEditing(null);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete material?"
        message={`"${deleting?.title ?? ""}" and its saved file will be removed.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await api.deleteMaterial(deleting.id);
          toast.deleted("Material deleted", `“${deleting.title}” was removed.`);
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}
