import { MOOD_CHECKINS_INIT } from "../data/mockData.js";
import { MOOD_STORAGE_KEY, getCurrentMoodDateKey, normalizeMoodEntry, sortMoodEntries } from "./dashboardMood.js";

const normalizeSeed = () => MOOD_CHECKINS_INIT.map((entry) => normalizeMoodEntry(entry));
const pruneEntriesToActiveDate = (entries, date = new Date()) => {
  const activeDateKey = getCurrentMoodDateKey(date);
  return sortMoodEntries(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizeMoodEntry(entry))
      .filter((entry) => String(entry.dateKey) === String(activeDateKey))
  );
};

export function readStoredMoodCheckins() {
  if (typeof window === "undefined") return normalizeSeed();

  try {
    const raw = window.localStorage.getItem(MOOD_STORAGE_KEY);
    if (!raw) return normalizeSeed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return normalizeSeed();
    const nextEntries = pruneEntriesToActiveDate(parsed);
    window.localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(nextEntries));
    return nextEntries;
  } catch {
    return normalizeSeed();
  }
}

export function writeStoredMoodCheckins(entries) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(pruneEntriesToActiveDate(entries)));
  } catch {
    // Ignora erros de quota/localStorage indisponivel no fallback local.
  }
}

export function getStoredMoodCheckinsForDate(dateKey = getCurrentMoodDateKey()) {
  return readStoredMoodCheckins().filter((entry) => String(entry.dateKey) === String(dateKey));
}
