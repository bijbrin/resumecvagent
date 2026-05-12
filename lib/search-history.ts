import type { ResultsData } from "@/components/results-view";

export interface SearchHistoryEntry {
  id: string;
  timestamp: number;
  jobUrl: string;
  results: ResultsData;
}

const STORAGE_KEY = "resume-optimizer-history";
const MAX_ENTRIES = 20;

export function saveSearch(jobUrl: string, results: ResultsData): string {
  const id = crypto.randomUUID();
  const entry: SearchHistoryEntry = { id, timestamp: Date.now(), jobUrl, results };
  const history = getHistory();
  history.unshift(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)));
  } catch { /* storage quota exceeded */ }
  return id;
}

export function getHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SearchHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function getSearchById(id: string): SearchHistoryEntry | null {
  return getHistory().find((e) => e.id === id) ?? null;
}

export function deleteSearch(id: string): void {
  const history = getHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}
