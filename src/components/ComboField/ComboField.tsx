import { useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { FieldShell } from "../TextField/TextField";
import { useDropdownPosition } from "./useDropdownPosition";
import "./ComboField.css";

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

/**
 * Text input with a styled suggestion dropdown (replaces <datalist>, whose
 * native popup only lists matches for the current text). Opening the list
 * shows every option; typing filters it; any typed value is still allowed.
 */
export default function ComboField({ label, options, value, onChange, placeholder, error }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const control = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  /** null = list opened without typing, so show all options */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const position = useDropdownPosition(open, control);

  const items = query
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function openList() {
    const current = options.findIndex((o) => o.toLowerCase() === value.trim().toLowerCase());
    setQuery(null);
    setActive(Math.max(0, current));
    setOpen(true);
  }

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setQuery(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else if (items.length) setActive((a) => (a + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else if (items.length) setActive((a) => (a - 1 + items.length) % items.length);
        break;
      case "Enter":
        if (!open) return; // let the form submit
        e.preventDefault();
        if (items[active]) choose(items[active]);
        else setOpen(false);
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
      <div className="field-control combo-control" ref={control}>
        <input
          ref={input}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          value={value}
          onClick={() => !open && openList()}
          onChange={(e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
        />
        <button
          type="button"
          tabIndex={-1}
          className={`combo-toggle${open ? " is-open" : ""}`}
          aria-label={open ? "Hide options" : "Show options"}
          onMouseDown={(e) => {
            e.preventDefault(); // keep focus in the input
            if (open) setOpen(false);
            else {
              input.current?.focus();
              openList();
            }
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            className="combo-list"
            style={position}
            onMouseDown={(e) => e.preventDefault()} // don't blur the input
          >
            {items.length === 0 ? (
              <li className="combo-empty">Press Enter to use “{value.trim()}”</li>
            ) : (
              items.map((option, i) => {
                const selected = option.toLowerCase() === value.trim().toLowerCase();
                return (
                  <li
                    key={option}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={selected}
                    className={`combo-option${i === active ? " is-active" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(option)}
                  >
                    <span>{option}</span>
                    {selected && <Check size={15} />}
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}
    </FieldShell>
  );
}
