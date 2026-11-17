import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export const DROPDOWN_MAX_HEIGHT = 240;

/**
 * Fixed-position style for a dropdown anchored under `anchor` (portaled to
 * <body> so scrolling dialogs can't clip it). Flips above when space is short
 * and follows the anchor on scroll/resize while open.
 */
export function useDropdownPosition(open: boolean, anchor: RefObject<HTMLElement | null>): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  const place = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const flip = below < DROPDOWN_MAX_HEIGHT + 16 && rect.top > below;
    setStyle(
      flip
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4 }
        : { left: rect.left, width: rect.width, top: rect.bottom + 4 },
    );
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return { ...style, maxHeight: DROPDOWN_MAX_HEIGHT };
}
