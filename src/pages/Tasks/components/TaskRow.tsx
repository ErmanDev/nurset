import { Check, Clock } from "lucide-react";
import type { Task } from "../../../lib/types";
import { categoryTone, completedLabel, dueLabel, priorityInfo, shortDate } from "../tasks";
import RowMenu from "../../../components/RowMenu/RowMenu";

export type TaskRowVariant = "today" | "overdue" | "upcoming" | "completed";

interface Props {
  task: Task;
  variant: TaskRowVariant;
  onToggle: (task: Task, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export default function TaskRow({ task, variant, onToggle, onEdit, onDelete }: Props) {
  const done = variant === "completed";
  const priority = priorityInfo[task.priority];

  return (
    <div className={`tk-row tk-row--${variant}`}>
      <label className="tk-check-wrap">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(e) => onToggle(task, e.target.checked)}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        />
        <span className="tk-check" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
      </label>

      <div className="tk-body">
        <p className="tk-title">{task.title}</p>
        {done ? (
          <p className="tk-meta">
            <span>{task.category}</span>
            <span>{completedLabel(task)}</span>
          </p>
        ) : (
          <p className="tk-meta">
            <span className={`tk-chip tk-chip--${categoryTone(task.category)}`}>{task.category}</span>
            {variant !== "upcoming" && (
              <span className={`tk-due${variant === "overdue" ? " is-overdue" : ""}`}>
                <Clock size={12} /> {dueLabel(task)}
              </span>
            )}
            {task.subject && <span>{task.subject}</span>}
          </p>
        )}
      </div>

      {variant === "upcoming" && <span className="tk-date">{shortDate(task.dueDate)}</span>}
      {(variant === "today" || variant === "overdue") && (
        <span className={`badge badge--${priority.tone} tk-priority`}>{priority.label}</span>
      )}

      <RowMenu label="Task actions" onEdit={() => onEdit(task)} onDelete={() => onDelete(task)} />
    </div>
  );
}
