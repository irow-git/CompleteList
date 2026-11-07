import { useCallback, useEffect, useState } from "react";

// Open state for a popover or dropdown that closes when the window is resized: where it opened no longer lines up with
// what it belongs to, and it's never moved after opening. Controlled or not, like Radix's own roots.
//
// One exception: an on-screen keyboard only changes the window's height, so a height-only change while something
// inside the open popover is being typed into leaves it open. Otherwise a touchscreen user could never type in a
// popover's search box. Any change of width closes it
export function useCloseOnResize({
  open,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange]
  );

  useEffect(() => {
    if (!isOpen) return;
    let width = window.innerWidth;
    const close = () => {
      const focused = document.activeElement;
      const typing =
        (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) && !!focused.closest("[data-slot$='-content']");
      const widthChanged = window.innerWidth !== width;
      width = window.innerWidth;
      if (typing && !widthChanged) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [isOpen, setOpen]);

  return [isOpen, setOpen] as const;
}
