import { create } from "zustand";

interface TaskPanelState {
  openTaskId: string | null;
  open: (taskId: string) => void;
  close: () => void;
}

// A single global store so any list/board/calendar row can open the same
// task detail slide-over without prop-drilling a "selected task" concept
// through every view.
export const useTaskPanelStore = create<TaskPanelState>((set) => ({
  openTaskId: null,
  open: (taskId) => set({ openTaskId: taskId }),
  close: () => set({ openTaskId: null }),
}));
