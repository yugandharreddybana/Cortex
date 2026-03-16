import { create } from "zustand";

export interface ToastItem {
  id:           string;
  title:        string;
  description?: string;
  duration?:    number; // ms, default 4000
}

interface ToastState {
  toasts:      ToastItem[];
  addToast:    (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }],
    })),

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative `toast()` — call from anywhere, no hook needed. */
export function toast(payload: Omit<ToastItem, "id">) {
  useToastStore.getState().addToast(payload);
}
