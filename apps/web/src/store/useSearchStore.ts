import { create } from "zustand";

interface SearchState {
  isOpen:     boolean;
  setIsOpen:  (open: boolean) => void;
  toggle:     () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  isOpen:    false,
  setIsOpen: (open) => set({ isOpen: open }),
  toggle:    () => set((s) => ({ isOpen: !s.isOpen })),
}));
