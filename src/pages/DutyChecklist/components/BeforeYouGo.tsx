import { Check } from "lucide-react";
import type { ReadinessKey } from "../../../lib/types";

const labels: Record<ReadinessKey, string> = {
  schedule: "Schedule checked",
  requirements: "Requirements checked",
  bag: "Duty bag checked",
  ci: "Reviewed CI reminder",
};

interface Props {
  readiness: { key: ReadinessKey; checked: boolean }[];
  onToggle: (key: ReadinessKey, checked: boolean) => void;
}

export default function BeforeYouGo({ readiness, onToggle }: Props) {
  const done = readiness.filter((r) => r.checked).length;
  const status =
    done === readiness.length
      ? { tone: "ready", title: "All Set!", text: "You're ready for your duty. Good luck!" }
      : done >= readiness.length / 2
        ? { tone: "almost", title: "Almost Ready", text: "A few preparation items still need attention" }
        : { tone: "notyet", title: "Not Ready Yet", text: "Work through your checklist before duty" };

  return (
    <section className="card prep-card prep-before">
      <p className="prep-progress-eyebrow">Before you go</p>
      <ul>
        {readiness.map((r) => (
          <li key={r.key}>
            <label className={`prep-before-item${r.checked ? " is-done" : ""}`}>
              <input type="checkbox" checked={r.checked} onChange={(e) => onToggle(r.key, e.target.checked)} />
              <span className="prep-check" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              {labels[r.key]}
            </label>
          </li>
        ))}
      </ul>
      <div className={`prep-status prep-status--${status.tone}`} role="status">
        <strong>{status.title}</strong>
        <span>{status.text}</span>
      </div>
    </section>
  );
}
