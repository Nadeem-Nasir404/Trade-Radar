import { useEffect, useState } from "react";

/** Current time, refreshed once a minute while `active` - enough for "held for" durations. */
export function useMinuteClock(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
