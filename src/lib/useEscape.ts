import { useEffect } from "react";

// Open-modal stack so Escape only closes the TOP modal when they nest
// (e.g. editing a client inside the Saved-clients manager).
const stack: Array<() => void> = [];

/** Close a modal on Escape — standard dialog behavior. Pass enabled=false
 *  while the modal is busy (mid-payment, mid-scan) to lock it open. */
export function useEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    stack.push(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      const i = stack.indexOf(onClose);
      if (i !== -1) stack.splice(i, 1);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, enabled]);
}
