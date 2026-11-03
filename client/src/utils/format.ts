import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import type { Priority } from "../types";

export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

export function isOverdue(dueDate: string | null | undefined, completed?: boolean): boolean {
  if (!dueDate || completed) return false;
  const date = new Date(dueDate);
  return isPast(date) && !isToday(date);
}

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_CLASSES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
