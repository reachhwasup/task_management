import { useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isToday, startOfDay } from "date-fns";
import type { Priority, Project, Task } from "../../types";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import { useUpdateTask } from "../../api/tasks";

const DAY_WIDTH = 32;
const LABEL_WIDTH = 220;
const ROW_HEIGHT = 36;
const DRAG_THRESHOLD_PX = 4;

const PRIORITY_BAR_COLOR: Record<Priority, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  URGENT: "#ef4444",
};

export default function TimelineView({ project, tasks }: { project: Project; tasks: Task[] }) {
  const openTask = useTaskPanelStore((s) => s.open);
  const sections = project.sections ?? [];
  const datedTasks = tasks.filter((t) => t.startDate || t.dueDate);
  const undatedCount = tasks.length - datedTasks.length;

  const { rangeStart, days } = useMemo(() => computeRange(datedTasks), [datedTasks]);
  const todayOffset = differenceInCalendarDays(startOfDay(new Date()), rangeStart);
  const monthGroups = useMemo(() => groupByMonth(days), [days]);

  const grouped = new Map<string | null, Task[]>();
  for (const task of datedTasks) {
    const key = task.sectionId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }
  const groups = [
    ...sections.map((s) => ({ id: s.id as string | null, name: s.name })),
    ...(grouped.has(null) ? [{ id: null, name: "No section" }] : []),
  ].filter((g) => (grouped.get(g.id) ?? []).length > 0);

  const gridWidth = days.length * DAY_WIDTH;
  const showTodayLine = todayOffset >= 0 && todayOffset < days.length;
  const todayLineLeft = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div style={{ width: LABEL_WIDTH + gridWidth }}>
          <div className="sticky top-0 z-20 flex">
            <div
              className="sticky left-0 z-30 shrink-0 border-b border-r border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500"
              style={{ width: LABEL_WIDTH }}
            >
              Task
            </div>
            <div style={{ width: gridWidth }}>
              <div className="flex border-b border-slate-200 bg-white">
                {monthGroups.map((g) => (
                  <div
                    key={g.key}
                    style={{ width: g.span * DAY_WIDTH }}
                    className="border-r border-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              <div className="flex border-b border-slate-200 bg-white">
                {days.map((d, i) => (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH }}
                    className={`border-r border-slate-50 py-1 text-center text-[10px] ${
                      isToday(d) ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-400"
                    }`}
                  >
                    {format(d, "d")}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.id ?? "none"}>
              <div className="flex">
                <div
                  className="sticky left-0 z-10 shrink-0 truncate border-b border-r border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  style={{ width: LABEL_WIDTH }}
                >
                  {group.name}
                </div>
                <div style={{ width: gridWidth }} className="relative border-b border-slate-100 bg-slate-50">
                  {showTodayLine && (
                    <div className="absolute bottom-0 top-0 w-px bg-red-300" style={{ left: todayLineLeft }} />
                  )}
                </div>
              </div>
              {(grouped.get(group.id) ?? []).map((task) => (
                <TimelineTaskRow
                  key={task.id}
                  task={task}
                  projectId={project.id}
                  rangeStart={rangeStart}
                  showTodayLine={showTodayLine}
                  todayLineLeft={todayLineLeft}
                  gridWidth={gridWidth}
                  onOpen={openTask}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {undatedCount > 0 && (
        <p className="border-t border-slate-100 px-6 py-2 text-xs text-slate-400">
          {undatedCount} task{undatedCount === 1 ? "" : "s"} without a due date not shown on the timeline. Drag a
          bar to reschedule, or drag its edges to resize.
        </p>
      )}
    </div>
  );
}

type DragMode = "move" | "resize-start" | "resize-end";

function TimelineTaskRow({
  task,
  projectId,
  rangeStart,
  showTodayLine,
  todayLineLeft,
  gridWidth,
  onOpen,
}: {
  task: Task;
  projectId: string;
  rangeStart: Date;
  showTodayLine: boolean;
  todayLineLeft: number;
  gridWidth: number;
  onOpen: (id: string) => void;
}) {
  const updateTask = useUpdateTask(task.id, projectId);
  const [drag, setDrag] = useState<{ mode: DragMode; deltaDays: number } | null>(null);
  const movedRef = useRef(false);

  const basePos = barPosition(task, rangeStart);
  const canResize = !!(task.startDate && task.dueDate);

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    movedRef.current = false;
    setDrag({ mode, deltaDays: 0 });

    function onMove(ev: PointerEvent) {
      const deltaPx = ev.clientX - startX;
      if (Math.abs(deltaPx) >= DRAG_THRESHOLD_PX) movedRef.current = true;
      setDrag({ mode, deltaDays: Math.round(deltaPx / DAY_WIDTH) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag((current) => {
        if (current && current.deltaDays !== 0) commitDrag(current.mode, current.deltaDays);
        return null;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function commitDrag(mode: DragMode, deltaDays: number) {
    const due = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
    const start = task.startDate ? startOfDay(new Date(task.startDate)) : null;

    if (mode === "move") {
      updateTask.mutate({
        startDate: start ? addDays(start, deltaDays).toISOString() : undefined,
        dueDate: due ? addDays(due, deltaDays).toISOString() : undefined,
      });
    } else if (mode === "resize-start" && start) {
      const newStart = addDays(start, deltaDays);
      if (due && newStart > due) return;
      updateTask.mutate({ startDate: newStart.toISOString() });
    } else if (mode === "resize-end" && due) {
      const newDue = addDays(due, deltaDays);
      if (start && newDue < start) return;
      updateTask.mutate({ dueDate: newDue.toISOString() });
    }
  }

  function handleBarClick() {
    if (movedRef.current) return; // this was a drag, not a click
    onOpen(task.id);
  }

  let bar = basePos;
  if (basePos && drag) {
    if (drag.mode === "move") {
      bar = { left: basePos.left + drag.deltaDays * DAY_WIDTH, width: basePos.width };
    } else if (drag.mode === "resize-start") {
      const newLeft = basePos.left + drag.deltaDays * DAY_WIDTH;
      bar = { left: newLeft, width: Math.max(basePos.width - drag.deltaDays * DAY_WIDTH, DAY_WIDTH) };
    } else {
      bar = { left: basePos.left, width: Math.max(basePos.width + drag.deltaDays * DAY_WIDTH, DAY_WIDTH) };
    }
  }

  return (
    <div className="flex">
      <button
        onClick={() => onOpen(task.id)}
        className="sticky left-0 z-10 shrink-0 truncate border-b border-r border-slate-100 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        style={{ width: LABEL_WIDTH }}
      >
        {task.title}
      </button>
      <div style={{ width: gridWidth, height: ROW_HEIGHT }} className="relative border-b border-slate-100">
        {showTodayLine && <div className="absolute bottom-0 top-0 w-px bg-red-400" style={{ left: todayLineLeft }} />}
        {bar && (
          <div
            className={`group absolute top-1.5 h-6 rounded-md shadow-sm ${task.completed ? "opacity-50" : ""} ${
              drag ? "" : "cursor-grab"
            }`}
            style={{ left: bar.left + 2, width: Math.max(bar.width - 4, 10), backgroundColor: PRIORITY_BAR_COLOR[task.priority] }}
            onPointerDown={(e) => beginDrag("move", e)}
            onClick={handleBarClick}
            title={task.title}
          >
            <span className="block truncate px-2 text-left text-[11px] font-medium leading-6 text-white">
              {task.title}
            </span>
            {canResize && (
              <>
                <div
                  onPointerDown={(e) => beginDrag("resize-start", e)}
                  className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-black/0 hover:bg-black/20"
                />
                <div
                  onPointerDown={(e) => beginDrag("resize-end", e)}
                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-black/0 hover:bg-black/20"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function computeRange(tasks: Task[]): { rangeStart: Date; days: Date[] } {
  const today = startOfDay(new Date());
  const dates: Date[] = [today];
  for (const t of tasks) {
    if (t.startDate) dates.push(startOfDay(new Date(t.startDate)));
    if (t.dueDate) dates.push(startOfDay(new Date(t.dueDate)));
  }
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const rangeStart = addDays(min, -2);
  const rangeEnd = addDays(max, 2);
  return { rangeStart, days: eachDayOfInterval({ start: rangeStart, end: rangeEnd }) };
}

function groupByMonth(days: Date[]): { key: string; label: string; span: number }[] {
  const groups: { key: string; label: string; span: number }[] = [];
  for (const day of days) {
    const key = format(day, "yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.span += 1;
    } else {
      groups.push({ key, label: format(day, "MMM yyyy"), span: 1 });
    }
  }
  return groups;
}

function barPosition(task: Task, rangeStart: Date): { left: number; width: number } | null {
  const due = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
  const start = task.startDate ? startOfDay(new Date(task.startDate)) : due;
  const end = due ?? start;
  if (!start || !end) return null;

  const left = differenceInCalendarDays(start, rangeStart) * DAY_WIDTH;
  const spanDays = Math.max(differenceInCalendarDays(end, start) + 1, 1);
  return { left, width: spanDays * DAY_WIDTH };
}
