import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Project, Task } from "../../types";
import { useCreateTask } from "../../api/projects";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import PriorityBadge from "../common/PriorityBadge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({ project, tasks }: { project: Project; tasks: Task[] }) {
  const [month, setMonth] = useState(new Date());
  const [quickAddDay, setQuickAddDay] = useState<Date | null>(null);
  const openTask = useTaskPanelStore((s) => s.open);
  const createTask = useCreateTask(project.id);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">{format(month, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonth(new Date())}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {WEEKDAYS.map((day) => (
          <div key={day} className="border-b border-slate-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-400">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);

          return (
            <div
              key={key}
              className={`group min-h-28 border-b border-r border-slate-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday(day) ? "bg-brand-600 font-semibold text-white" : "text-slate-400"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <button
                  onClick={() => setQuickAddDay(day)}
                  className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openTask(task.id)}
                    className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-slate-100 ${
                      task.completed ? "text-slate-400 line-through" : "text-slate-700"
                    }`}
                  >
                    <PriorityBadge priority={task.priority} />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <p className="px-1 text-[11px] text-slate-400">+{dayTasks.length - 3} more</p>
                )}
              </div>
              {quickAddDay && isSameDay(quickAddDay, day) && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
                    if (title) {
                      await createTask.mutateAsync({ title, dueDate: day.toISOString() });
                    }
                    setQuickAddDay(null);
                  }}
                >
                  <input
                    name="title"
                    autoFocus
                    onBlur={() => setQuickAddDay(null)}
                    placeholder="Task name"
                    className="mt-1 w-full rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none"
                  />
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
