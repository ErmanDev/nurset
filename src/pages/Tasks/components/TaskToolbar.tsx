import { ChevronDown } from "lucide-react";
import { TASK_CATEGORIES, priorityInfo, type TaskTab } from "../tasks";

const tabs: { value: TaskTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

interface Props {
  tab: TaskTab;
  onTab: (tab: TaskTab) => void;
  category: string;
  onCategory: (value: string) => void;
  priority: string;
  onPriority: (value: string) => void;
}

export default function TaskToolbar({ tab, onTab, category, onCategory, priority, onPriority }: Props) {
  return (
    <div className="tasks-toolbar">
      <div className="tasks-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            className={tab === t.value ? "is-active" : ""}
            onClick={() => onTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="tasks-filter">
        <select value={category} onChange={(e) => onCategory(e.target.value)} aria-label="Category">
          <option value="">All Categories</option>
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ChevronDown size={15} />
      </label>

      <label className="tasks-filter">
        <select value={priority} onChange={(e) => onPriority(e.target.value)} aria-label="Priority">
          <option value="">All priorities</option>
          {Object.entries(priorityInfo).map(([value, p]) => (
            <option key={value} value={value}>
              {p.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>
  );
}
