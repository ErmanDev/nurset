import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Link } from "react-router";
import { formatDuration } from "../../../lib/format";
import type { Task } from "../../../lib/types";

interface Props {
  tasks: Task[];
  onToggle: (id: number, completed: boolean) => void;
  onAdd: (title: string) => Promise<void>;
}

export default function TodaysTasks({ tasks, onToggle, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle("");
    setAdding(false);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <p className="eyebrow eyebrow--accent">Stay on track</p>
          <h2 className="section-title">Today's tasks</h2>
        </div>
        <button className="text-link" onClick={() => setAdding((v) => !v)}>
          <Plus size={13} /> Add task
        </button>
      </div>

      <div className="card tasks">
        {adding && (
          <form className="task-add" onSubmit={submit}>
            <input
              autoFocus
              value={title}
              placeholder="What do you need to do today?"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <button type="submit" disabled={!title.trim()}>
              Add
            </button>
          </form>
        )}

        {tasks.length === 0 && !adding && <p className="empty-text">Nothing planned for today.</p>}

        {tasks.map((task) => {
          const duration = formatDuration(task.durationMinutes);
          return (
            <label key={task.id} className={`task-row${task.completed ? " is-done" : ""}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => onToggle(task.id, e.target.checked)}
              />
              <span className="task-check" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              <span>
                <span className="row-title task-title">{task.title}</span>
                <span className="row-meta">
                  {task.category}
                  {duration && ` · ${duration}`}
                </span>
              </span>
            </label>
          );
        })}

        <Link to="/tasks" className="text-link tasks-footer">
          View all tasks <ArrowRight size={13} />
        </Link>
      </div>
    </section>
  );
}
