import { MOOD_CHECKINS_INIT } from "../data/mockData.js";
import { MOOD_STORAGE_KEY, getLocalDateKey, normalizeMoodEntry, sortMoodEntries } from "./dashboardMood.js";

const normalizeSeed = () => MOOD_CHECKINS_INIT.map((entry) => normalizeMoodEntry(entry));

export function readStoredMoodCheckins() {
  if (typeof window === "undefined") return normalizeSeed();

  try {
    const raw = window.localStorage.getItem(MOOD_STORAGE_KEY);
    if (!raw) return normalizeSeed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return normalizeSeed();
    return sortMoodEntries(parsed.map((entry) => normalizeMoodEntry(entry)));
  } catch {
    return normalizeSeed();
  }
}

export function writeStoredMoodCheckins(entries) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      MOOD_STORAGE_KEY,
      JSON.stringify(sortMoodEntries(entries.map((entry) => normalizeMoodEntry(entry))))
    );
  } catch {
    // Ignora erros de quota/localStorage indisponivel no fallback local.
  }
}

export function getStoredMoodCheckinsForDate(dateKey = getLocalDateKey()) {
  return readStoredMoodCheckins().filter((entry) => String(entry.dateKey) === String(dateKey));
}
