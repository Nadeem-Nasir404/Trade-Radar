import { useEffect, useState } from "react";

/** `value`, updated only once it has stopped changing for `delayMs` - e.g. search text, so a query runs per pause, not per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
