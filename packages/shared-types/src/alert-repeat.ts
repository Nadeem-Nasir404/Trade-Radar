/** How often a fired alert may keep reminding the user while its condition still holds (minutes). */
export const REPEAT_INTERVAL_MINUTES = [5, 10, 15, 30, 60] as const;
export type RepeatIntervalMinutes = (typeof REPEAT_INTERVAL_MINUTES)[number];

/** Reminders stop after this many for one trigger, so a level that stays crossed overnight can't page all night. */
export const MAX_ALERT_REMINDERS = 24;

/**
 * Conditions that describe a lasting state ("price is above X"), so "still true" has a meaning.
 * EQUALS is a single touch and PCT_CHANGE_WINDOW resets its own baseline, so neither repeats.
 */
export const REPEATABLE_CONDITIONS = [
  "ABOVE",
  "BELOW",
  "CROSSES_ABOVE",
  "CROSSES_BELOW",
  "ENTERS_RANGE",
  "EXITS_RANGE",
  "PCT_CHANGE",
] as const;
