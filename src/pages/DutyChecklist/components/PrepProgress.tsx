import type { ChecklistDetail } from "../../../lib/types";

export default function PrepProgress({ checklist }: { checklist: ChecklistDetail }) {
  const total = checklist.items.length;
  const ready = checklist.items.filter((i) => i.checked).length;
  const percent = total ? Math.round((ready / total) * 100) : 0;
  const remaining = total - ready;

  return (
    <section className="card prep-card prep-progress">
      <p className="prep-progress-eyebrow">Preparation progress</p>
      <h3>{checklist.name}</h3>
      <div className="prep-progress-row">
        <span>
          {ready} of {total} items ready
        </span>
        <strong>{percent}%</strong>
      </div>
      <div className="prep-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="prep-progress-foot">
        {remaining === 0 ? "Everything is packed" : `${remaining} item${remaining === 1 ? "" : "s"} remaining`}
      </p>
    </section>
  );
}
