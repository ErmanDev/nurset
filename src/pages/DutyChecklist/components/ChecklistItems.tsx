import { Check, Plus, X } from "lucide-react";
import type { ChecklistItem } from "../../../lib/types";

interface Props {
  items: ChecklistItem[];
  doneText: string;
  todoText: string;
  /** When set, a text link under the list (e.g. "Add preparation reminder"). */
  footerAddLabel?: string;
  onAddClick?: () => void;
  onToggle: (item: ChecklistItem, checked: boolean) => void;
  onDelete: (item: ChecklistItem) => void;
}

export default function ChecklistItems({
  items,
  doneText,
  todoText,
  footerAddLabel,
  onAddClick,
  onToggle,
  onDelete,
}: Props) {
  return (
    <div className="prep-list">
      {items.length === 0 && <p className="empty-text">Nothing here yet.</p>}

      {items.map((item) => (
        <div key={item.id} className={`prep-item${item.checked ? " is-done" : ""}`}>
          <label className="prep-check-wrap">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => onToggle(item, e.target.checked)}
              aria-label={item.label}
            />
            <span className="prep-check" aria-hidden="true">
              <Check size={13} strokeWidth={3} />
            </span>
          </label>
          <div className="prep-item-text">
            <p>{item.label}</p>
            <span>{item.checked ? doneText : todoText}</span>
          </div>
          <button className="prep-item-remove" onClick={() => onDelete(item)} aria-label={`Remove ${item.label}`}>
            <X size={15} />
          </button>
        </div>
      ))}

      {footerAddLabel && onAddClick && (
        <button className="text-link prep-add-link" onClick={onAddClick}>
          <Plus size={14} /> {footerAddLabel}
        </button>
      )}
    </div>
  );
}
