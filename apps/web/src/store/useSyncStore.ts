import { create } from "zustand";

interface SyncFolder {
  id: string;
  name: string;
  emoji: string;
  parentId?: string;
}

interface SyncTag {
  id: string;
  name: string;
  color: string;
}

interface SyncState {
  folders: SyncFolder[];
  tags: SyncTag[];
  addFolder: (folder: SyncFolder) => void;
  deleteFolder: (folderId: string) => void;
  addTag: (tag: SyncTag) => void;
  deleteTag: (tagId: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  folders: [],
  tags: [],
  addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
  deleteFolder: (folderId) => set((state) => ({ folders: state.folders.filter(f => f.id !== folderId) })),
  addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
  deleteTag: (tagId) => set((state) => ({ tags: state.tags.filter(t => t.id !== tagId) })),
}));
