import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface Props {
  /** Digits entered so far; a space marks an empty box in the middle. */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * One-time-code input: one box per digit, auto-advances, supports
 * backspace/arrow keys and pasting the whole code.
 */
export default function CodeInput({ value, onChange, length = 6, invalid, autoFocus }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => boxes.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function setDigit(i: number, digit: string) {
    const chars = value.padEnd(length, " ").split("");
    chars[i] = digit || " ";
    onChange(chars.join("").replace(/\s+$/, "")); // keep gaps so later digits don't shift
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i]?.trim()) {
      e.preventDefault();
      setDigit(i - 1, "");
      focus(i - 1);
    } else if (e.key === "ArrowLeft") {
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      focus(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    focus(digits.length);
  }

  return (
    <div className={`code-input${invalid ? " is-invalid" : ""}`} role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          value={value[i]?.trim() ?? ""}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "").slice(-1);
            setDigit(i, digit);
            if (digit) focus(i + 1);
          }}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
