import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone: ToastItem["tone"]) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message, tone) => {
    const id = ++counter;
    set((s) => ({ items: [...s.items, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), tone === "error" ? 6000 : 3000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (message: string) => useToasts.getState().push(message, "info"),
  error: (message: string) => useToasts.getState().push(message, "error"),
};
