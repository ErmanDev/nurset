import { ChevronDown, CircleHelp } from "lucide-react";
import { QlHeader } from "./shared";
import "./QuickLinks.css";

const faqs: { q: string; a: string }[] = [
  {
    q: "How do I add a clinical duty?",
    a: "Open Duty Schedule and click “+ Add Duty”, or click a date on the Duty Calendar. The next duty then appears on your dashboard and in Duty Checklist.",
  },
  {
    q: "How do I submit a requirement document?",
    a: "Go to Requirements and click “Upload Document”. Drag in your file, choose the document type, and submit. Its status starts as Pending Review.",
  },
  {
    q: "How do I prepare for my next duty?",
    a: "Open Duty Checklist. Tick off your Duty Bag items and rotation reminders, check “Requirements to Bring”, then complete the “Before you go” checks.",
  },
  {
    q: "Is AI Study using real AI?",
    a: "Not yet. Quizzes come from a built-in practice question bank and the assistant gives placeholder replies until an AI service is connected.",
  },
  {
    q: "Where is my data stored?",
    a: "Your records are kept in NurSet's PostgreSQL database (for now a local one running in Docker on this computer), separate from other students' data. Uploaded files are stored in the NurSet app-data folder on this computer.",
  },
  {
    q: "Can I share materials with classmates?",
    a: "Uploads are saved to your own Learning Hub on this device. Sharing with classmates needs an online service, which isn't available yet.",
  },
];

export default function HelpSupport() {
  return (
    <div className="ql">
      <QlHeader title="Help & Support" subtitle="Answers to common questions about using NurSet" />

      <div className="ql-two-col">
        <div className="ql-col">
          {faqs.map((f) => (
            <details key={f.q} className="card hs-faq">
              <summary>
                {f.q}
                <ChevronDown size={18} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <aside className="ql-col">
          <section className="card ql-side">
            <h3>Still need help?</h3>
            <p className="ql-side-sub">
              For questions about schedules, requirements, or school policies, contact your clinical instructor or
              nursing department.
            </p>
            <p className="ql-side-note">
              <CircleHelp size={15} /> NurSet organizes your own notes and records. Always follow official instructions
              from your school.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
