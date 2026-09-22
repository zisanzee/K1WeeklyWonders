import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Conditional className helper: clsx resolves the conditional parts, then
// tailwind-merge collapses conflicting Tailwind utilities so the LAST one
// wins (e.g. `px-2 px-4` → `px-4`) instead of both landing in the class list
// and leaving the result up to stylesheet order.
//
// This was previously copy-pasted verbatim into six components. Keep it in one
// place — it is the shared util the project conventions already refer to.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
