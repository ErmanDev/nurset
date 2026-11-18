import { useState, type FormEvent } from "react";
import { Bell, Megaphone, Trash2, Users } from "lucide-react";
import { api } from "../../lib/api";
import { ciApi, type AnnouncementCategory, type CiAnnouncement } from "../../lib/instructor";
import { formatLongDate } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import Modal from "../../components/Modal/Modal";
import SelectMenu from "../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import { toast } from "../../components/Toast/Toast";
import "../QuickLinks/QuickLinks.css";
import "./Instructor.css";
import "./InstructorTools.css";

const categories: { value: AnnouncementCategory; label: string; tone: string }[] = [
  { value: "important", label: "Important", tone: "purple" },
  { value: "academic", label: "Academic", tone: "purple" },
  { value: "reminder", label: "Reminder", tone: "amber" },
];

export default function CiAnnouncements() {
  const { data: items, error, reload } = useAsync(ciApi.listAnnouncements);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CiAnnouncement | null>(null);

  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Clinical instruction</p>
          <h1>Announcements</h1>
          <p>Post updates to your groups. Students see them on their Announcements page.</p>
        </header>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Megaphone size={15} /> New Announcement
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!items && !error && <div className="skeleton" style={{ height: 200 }} />}
      {items && items.length === 0 && (
        <div className="card ci-empty">
          <p className="empty-text">You haven't posted any announcements yet.</p>
        </div>
      )}

      <div className="ci-items">
        {items?.map((a) => {
          const c = categories.find((x) => x.value === a.category) ?? categories[0];
          const Icon = a.category === "reminder" ? Bell : Megaphone;
          return (
            <article key={a.id} className="card an-card">
              <span className={`an-icon an-tone--${c.tone}`}>
                <Icon size={18} />
              </span>
              <div className="ci-item-body">
                <p className={`an-category an-tone-text--${c.tone}`}>{c.label}</p>
                <h3>{a.title}</h3>
                <p className="an-body">{a.body}</p>
                <p className="ci-item-meta">
                  <span>
                    <Users size={13} /> {a.audience}
                  </span>
                  <span>Posted {formatLongDate(a.postedAt)}</span>
                </p>
              </div>
              <button className="ci-remove" onClick={() => setDeleting(a)} aria-label={`Delete ${a.title}`} title="Delete announcement">
                <Trash2 size={15} />
              </button>
            </article>
          );
        })}
      </div>

      {creating && (
        <AnnouncementModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete announcement?"
        message={`"${deleting?.title ?? ""}" will be removed for your students.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await ciApi.deleteAnnouncement(deleting.id);
          toast.deleted("Announcement deleted", `“${deleting.title}” was removed for your students.`);
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}

function AnnouncementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: groups } = useAsync(api.listGroups);
  const [category, setCategory] = useState<AnnouncementCategory>("important");
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Add a title.";
    if (!body.trim()) next.body = "Write the announcement.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setServerError(null);
    try {
      await ciApi.createAnnouncement({ category, title, body, groupId: audience === "all" ? null : Number(audience) });
      const group = groups?.find((g) => String(g.id) === audience);
      toast.created("Announcement posted", `“${title.trim()}” was sent to ${group ? group.name : "all your groups"}.`);
      onSaved();
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="New announcement"
      title="Post Announcement"
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="announcement-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Posting…" : "Post"}
          </button>
        </>
      }
    >
      <form id="announcement-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <div className="form-row-2">
          <SelectMenu label="Category" options={categories.map((c) => ({ value: c.value, label: c.label }))} value={category} onChange={(v) => setCategory(v as AnnouncementCategory)} />
          <SelectMenu
            label="Audience"
            options={[{ value: "all", label: "All my groups" }, ...(groups ?? []).map((g) => ({ value: String(g.id), label: g.name }))]}
            value={audience}
            onChange={setAudience}
          />
        </div>
        <TextField label="Title" placeholder="e.g. Skills lab orientation" autoFocus value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Message" rows={5} placeholder="What do your students need to know?" value={body} error={errors.body} onChange={(e) => setBody(e.target.value)} />
      </form>
    </Modal>
  );
}
