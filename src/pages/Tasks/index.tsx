import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { Task } from "../../lib/types";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import TaskStats from "./components/TaskStats";
import TaskToolbar from "./components/TaskToolbar";
import TaskSection from "./components/TaskSection";
import TaskRow from "./components/TaskRow";
import TaskFormModal from "./components/TaskFormModal";
import { bucketTasks, groupByDate, type TaskTab } from "./tasks";
import "./Tasks.css";

const COMPLETED_PREVIEW = 8;

type FormState = { mode: "add" } | { mode: "edit"; task: Task } | null;

export default function Tasks() {
  const { data: tasks, error, reload, setData } = useAsync(api.listTasks);
  const [tab, setTab] = useState<TaskTab>("all");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const today = todayIso();

  // Stat cards always reflect every task; sections respect the filters.
  const all = useMemo(() => bucketTasks(tasks ?? [], today), [tasks, today]);
  const filtered = useMemo(
    () =>
      bucketTasks(
        (tasks ?? []).filter(
          (t) => (!category || t.category === category) && (!priority || t.priority === priority),
        ),
        today,
      ),
    [tasks, today, category, priority],
  );

  const show = {
    overdue: tab === "all" || tab === "today",
    today: tab === "all" || tab === "today",
    upcoming: tab === "all" || tab === "upcoming",
    completed: tab === "all" || tab === "completed",
  };

  async function toggle(task: Task, completed: boolean) {
    // Optimistic: move the row right away, then sync with the database.
    setData((list) =>
      list?.map((t) =>
        t.id === task.id
          ? { ...t, completed, completedAt: completed ? `${today} ${new Date().toTimeString().slice(0, 8)}` : null }
          : t,
      ) ?? null,
    );
    try {
      await api.toggleTask(task.id, completed);
    } finally {
      await reload();
    }
  }

  const rowProps = {
    onToggle: toggle,
    onEdit: (task: Task) => setForm({ mode: "edit", task }),
    onDelete: (task: Task) => setDeleting(task),
  };

  const completedVisible = showAllCompleted
    ? filtered.completed
    : filtered.completed.slice(0, COMPLETED_PREVIEW);

  return (
    <div className="tasks-page">
      <header className="page-header page-header--plain">
        <p className="eyebrow">Plan your day</p>
        <h1>Tasks</h1>
        <p>Organize and keep track of your responsibilities.</p>
      </header>

      {error && <div className="alert-error">Couldn't load your tasks: {error}</div>}

      <TaskStats
        loading={!tasks}
        counts={{
          today: all.today.length + all.completed.filter((t) => t.dueDate === today).length,
          upcoming: all.upcoming.length,
          completed: all.completed.length,
          overdue: all.overdue.length,
        }}
      />

      <section className="tasks-main">
        <div className="tasks-main-head">
          <div>
            <h2 className="tasks-heading">My Tasks</h2>
            <p className="tasks-sub">Manage your nursing assignments, deadlines, and daily responsibilities</p>
          </div>
          <button className="btn btn-primary tasks-add" onClick={() => setForm({ mode: "add" })}>
            <Plus size={15} /> Add Task
          </button>
        </div>

        <TaskToolbar
          tab={tab}
          onTab={setTab}
          category={category}
          onCategory={setCategory}
          priority={priority}
          onPriority={setPriority}
        />

        {!tasks && !error && <div className="skeleton" style={{ height: 280 }} />}

        {tasks && (
          <div className="tasks-sections">
            {show.overdue && filtered.overdue.length > 0 && (
              <TaskSection
                eyebrow="Needs attention"
                title="Overdue"
                tone="danger"
                aside={<span className="tasks-pill tasks-pill--red">{filtered.overdue.length} overdue</span>}
              >
                {filtered.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} variant="overdue" {...rowProps} />
                ))}
              </TaskSection>
            )}

            {show.today && (
              <TaskSection
                eyebrow={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                title="Today's Task"
                aside={<span className="tasks-pill">{filtered.today.length} remaining</span>}
              >
                {filtered.today.length === 0 ? (
                  <p className="empty-text tasks-empty">You're all caught up for today.</p>
                ) : (
                  filtered.today.map((t) => <TaskRow key={t.id} task={t} variant="today" {...rowProps} />)
                )}
              </TaskSection>
            )}

            {show.upcoming && (
              <TaskSection eyebrow="Plan ahead" title="Upcoming Task" collapsible>
                {filtered.upcoming.length === 0 ? (
                  <p className="empty-text tasks-empty">No upcoming tasks.</p>
                ) : (
                  groupByDate(filtered.upcoming).map((group) => (
                    <div key={group.date} className="tasks-group">
                      <p className="tasks-group-label">{group.label}</p>
                      {group.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} variant="upcoming" {...rowProps} />
                      ))}
                    </div>
                  ))
                )}
              </TaskSection>
            )}

            {show.completed && (
              <TaskSection
                title={
                  <span className="tasks-completed-title">
                    <Check size={18} strokeWidth={2.5} /> Completed
                    <span className="tasks-count">{filtered.completed.length}</span>
                  </span>
                }
                compact
                collapsible
              >
                {filtered.completed.length === 0 ? (
                  <p className="empty-text tasks-empty">Completed tasks will show up here.</p>
                ) : (
                  <>
                    {completedVisible.map((t) => (
                      <TaskRow key={t.id} task={t} variant="completed" {...rowProps} />
                    ))}
                    {filtered.completed.length > COMPLETED_PREVIEW && (
                      <button className="text-link tasks-more" onClick={() => setShowAllCompleted((v) => !v)}>
                        {showAllCompleted ? "Show less" : `Show all ${filtered.completed.length}`}
                      </button>
                    )}
                  </>
                )}
              </TaskSection>
            )}
          </div>
        )}
      </section>

      {form && (
        <TaskFormModal
          task={form.mode === "edit" ? form.task : undefined}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete task?"
        message={`"${deleting?.title ?? ""}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await api.deleteTask(deleting.id);
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}
