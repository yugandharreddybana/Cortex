// Mock data for public share pages — mirrors the dashboard store seed data.
// In production this would be fetched from a real API.

export interface SharedHighlight {
  id:         string;
  text:       string;
  source:     string;
  url:        string;
  topic:      string;
  topicColor: string;
  savedAt:    string;
  folder?:    string;
  isCode?:    boolean;
}

export interface SharedFolder {
  id:     string;
  name:   string;
  emoji:  string;
  highlights: SharedHighlight[];
}

// No hardcoded mock data. All data should be fetched from the server or user input.
const HIGHLIGHTS: SharedHighlight[] = [];
const FOLDERS: SharedFolder[] = [];

export function getHighlight(id: string): SharedHighlight | undefined {
  return HIGHLIGHTS.find((h) => h.id === id);
}

export function getFolder(id: string): SharedFolder | undefined {
  return FOLDERS.find((f) => f.id === id);
}
