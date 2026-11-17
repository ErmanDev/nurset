import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, CircleHelp, ClipboardList, GraduationCap, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import Modal from "../../components/Modal/Modal";
import { QlHeader, checkMaterialFile, fileDescription } from "./shared";
import "./QuickLinks.css";

interface Topic {
  title: string;
  text: string;
  icon: LucideIcon;
  /** General guidance shown in a dialog; the official handbook always takes precedence. */
  points?: string[];
  to?: string;
}

const topics: Topic[] = [
  {
    title: "Academic Policies",
    text: "Program expectations, attendance, and academic conduct",
    icon: GraduationCap,
    points: [
      "Know the attendance rules for lectures, skills laboratory, and clinical duty — absences are often tracked separately.",
      "Check the grading system and minimum passing grades for nursing courses.",
      "Follow the academic integrity policy for exams, care plans, and case studies.",
      "Note the deadlines for submissions, make-up work, and grade appeals.",
    ],
  },
  {
    title: "Clinical Guidelines",
    text: "Duty expectations, professional conduct, and preparation",
    icon: Stethoscope,
    points: [
      "Arrive on time in complete, proper uniform with your ID.",
      "Prepare your assigned topics, drug studies, and care plans before duty.",
      "Perform procedures only under the supervision of your clinical instructor.",
      "Report incidents and errors to your clinical instructor immediately.",
    ],
  },
  {
    title: "Safety & Privacy",
    text: "Patient confidentiality and safe student practices",
    icon: ShieldCheck,
    points: [
      "Never share patient names or identifying details outside the care team.",
      "Don't take photos or videos of patients or charts.",
      "Remove identifiers from notes, care plans, and case presentations.",
      "Practice hand hygiene and follow infection-control and PPE rules.",
    ],
  },
  {
    title: "Requirements",
    text: "Documents, clearances, and required student records",
    icon: ClipboardList,
    to: "/requirements",
  },
];

export default function Handbook() {
  const navigate = useNavigate();
  const { data: handbook, reload } = useAsync(api.getHandbook);
  const input = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addHandbook(file: File | undefined) {
    if (!file) return;
    const problem = checkMaterialFile(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await api.uploadMaterial(file, { title: "Nursing Student Handbook", kind: "handbook" });
      await reload();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    if (!handbook) return input.current?.click();
    try {
      await api.openMaterial(handbook.id);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="ql">
      <QlHeader
        title="Student Handbook"
        subtitle="Find essential nursing program policies, clinical guidelines, and student resources"
      />

      <div className="ql-two-col">
        <div className="ql-col">
          {error && <div className="alert-error">{error}</div>}
          <section className="card hb-hero">
            <span className="hb-hero-icon">
              <BookOpen size={26} />
            </span>
            <div>
              <p className="hb-eyebrow">Student resource</p>
              <h2>Nursing Student Handbook</h2>
              <p className="hb-sub">Your guide to program policies, clinical expectations, and student responsibilities.</p>
              <p className="hb-meta">
                {handbook ? `Handbook · ${fileDescription(handbook)}` : "Add your school's handbook PDF to open it here"}
              </p>
              <div className="hb-actions">
                <button className="btn hb-btn" onClick={view} disabled={busy}>
                  {busy ? "Saving…" : handbook ? "View Handbook" : "Add Handbook PDF"}
                </button>
                {handbook && (
                  <button className="text-link" onClick={() => input.current?.click()} disabled={busy}>
                    Replace file
                  </button>
                )}
              </div>
              <input
                ref={input}
                type="file"
                accept=".pdf,.doc,.docx"
                hidden
                onChange={(e) => {
                  void addHandbook(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </section>

          <div className="hb-topics">
            {topics.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.title}
                  className="card hb-topic"
                  onClick={() => (t.to ? navigate(t.to) : setTopic(t))}
                >
                  <span className="hb-topic-icon">
                    <Icon size={18} />
                  </span>
                  <strong>{t.title}</strong>
                  <span>{t.text}</span>
                </button>
              );
            })}
          </div>

          <p className="ql-footnote">
            Reminder: Follow the current policies and instructions issued by your nursing school and clinical placement
            facility.
          </p>
        </div>

        <aside className="ql-col">
          <section className="card ql-side">
            <h3>Using the Handbook</h3>
            <p className="ql-side-sub">
              Use these topics to find the guidance you need. For official rules, always refer to the latest handbook
              issued by your nursing department.
            </p>
            <p className="ql-side-note">
              <CircleHelp size={15} /> Need clarification? Contact your clinical instructor or nursing department.
            </p>
          </section>
        </aside>
      </div>

      {topic && (
        <Modal
          open
          onClose={() => setTopic(null)}
          eyebrow="Student handbook"
          title={topic.title}
          width={480}
          footer={
            <button className="btn btn-secondary" onClick={() => setTopic(null)}>
              Close
            </button>
          }
        >
          <ul className="hb-points">
            {topic.points?.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="hb-points-note">
            General guidance only — your school's official handbook and your clinical instructor's instructions take
            precedence.
          </p>
        </Modal>
      )}
    </div>
  );
}
