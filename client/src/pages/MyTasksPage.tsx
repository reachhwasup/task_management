import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { useMyTasks } from "../api/tasks";
import { useUpdateTask } from "../api/tasks";
import { useTaskPanelStore } from "../store/taskPanel.store";
import PriorityBadge from "../components/common/PriorityBadge";
import AssigneeAvatars from "../components/common/AssigneeAvatars";
import { formatDueDate, isOverdue } from "../utils/format";
import type { Task } from "../types";

export default function MyTasksPage() {
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: tasks } = useMyTasks(showCompleted);
  const { workspaceId } = useParams();

  const workspaceTasks = (tasks ?? []).filter((t) => t.project?.workspaceId === workspaceId);

  const overdue = workspaceTasks.filter((t) => isOverdue(t.dueDate, t.completed));
  const today = workspaceTasks.filter(
    (t) => !isOverdue(t.dueDate, t.completed) && t.dueDate && formatDueDate(t.dueDate) === "Today"
  );
  const upcoming = workspaceTasks.filter(
    (t) => !overdue.includes(t) && !today.includes(t) && t.dueDate
  );
  const noDate = workspaceTasks.filter((t) => !t.dueDate);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My tasks</h1>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>
      </div>

      {!workspaceTasks.length && <p className="text-sm text-slate-400">Nothing assigned to you here yet.</p>}

      <Group title="Overdue" tasks={overdue} accent="text-red-600" />
      <Group title="Today" tasks={today} accent="text-brand-700" />
      <Group title="Upcoming" tasks={upcoming} accent="text-slate-600" />
      <Group title="No due date" tasks={noDate} accent="text-slate-600" />
    </div>
  );
}

function Group({ title, tasks, accent }: { title: string; tasks: Task[]; accent: string }) {
  if (!tasks.length) return null;
  return (
    <div className="mb-6">
      <h3 className={`mb-1.5 px-1 text-sm font-semibold ${accent}`}>
        {title} <span className="font-normal text-slate-400">{tasks.length}</span>
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const updateTask = useUpdateTask(task.id, task.projectId);
  const openTask = useTaskPanelStore((s) => s.open);
  const navigate = useNavigate();
  const overdue = isOverdue(task.dueDate, task.completed);

  return (
    <div className="flex items-center gap-3 border-t border-slate-50 px-4 py-2.5 first:border-t-0 hover:bg-slate-50">
      <button
        onClick={() => updateTask.mutate({ completed: !task.completed })}
        className={task.completed ? "text-emerald-600" : "text-slate-300 hover:text-slate-400"}
      >
        {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <button
        onClick={() => openTask(task.id)}
        className={`flex-1 truncate text-left text-sm ${
          task.completed ? "text-slate-400 line-through" : "text-slate-800"
        }`}
      >
        {task.title}
      </button>
      {task.project && (
        <button
          onClick={() => navigate(`/w/${task.project!.workspaceId}/projects/${task.project!.id}`)}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.project.color }} />
          {task.project.name}
        </button>
      )}
      <PriorityBadge priority={task.priority} />
      {task.dueDate && (
        <span className={`text-xs ${overdue ? "font-medium text-red-600" : "text-slate-400"}`}>
          {formatDueDate(task.dueDate)}
        </span>
      )}
      <AssigneeAvatars assignees={task.assignees} size="sm" />
    </div>
  );
}
