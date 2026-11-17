import { useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { FieldShell } from "../TextField/TextField";
import { useDropdownPosition } from "../ComboField/useDropdownPosition";
import "../ComboField/ComboField.css";
import "./SelectMenu.css";

export interface SelectMenuOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: SelectMenuOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

/**
 * Select with an app-styled dropdown (the native <select> popup in WebView2
 * doesn't match the design). Pick-only; for free text use ComboField.
 */
export default function SelectMenu({ label, options, value, onChange, placeholder = "Select", error }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const position = useDropdownPosition(open, trigger);

  const selected = options.find((o) => o.value === value);

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(option: SelectMenuOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return openList();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((a) => (a + step + options.length) % options.length);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) openList();
        else if (options[active]) choose(options[active]);
        break;
      case "Escape":
        if (open) {
          e.stopPropagation(); // close the list, not the dialog
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="field-control">
        <button
          ref={trigger}
          id={id}
          type="button"
          className={`select-trigger${open ? " is-open" : ""}${selected ? "" : " is-placeholder"}`}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
        >
          <span>{selected?.label ?? placeholder}</span>
          <ChevronDown size={18} />
        </button>
      </div>

      {open &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            className="combo-list"
            style={position}
            onMouseDown={(e) => e.preventDefault()} // keep focus on the trigger
          >
            {options.map((option, i) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`combo-option${i === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={15} />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </FieldShell>
  );
}
