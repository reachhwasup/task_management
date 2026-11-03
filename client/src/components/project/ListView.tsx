import { FormEvent, useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, GripVertical, Plus } from "lucide-react";
import type { Project, Task } from "../../types";
import { useCreateTask, useCreateSection, useUpdateSection } from "../../api/projects";
import { useUpdateTask } from "../../api/tasks";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import AssigneeAvatars from "../common/AssigneeAvatars";
import PriorityBadge from "../common/PriorityBadge";
import SectionHeader from "./SectionHeader";
import { formatDueDate, isOverdue } from "../../utils/format";

export default function ListView({ project, tasks }: { project: Project; tasks: Task[] }) {
  const sections = project.sections ?? [];
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const createSection = useCreateSection(project.id);
  const updateSection = useUpdateSection(project.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setSectionOrder(sections.map((s) => s.id));
  }, [sections]);

  const grouped = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const key = task.sectionId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  async function handleAddSection(e: FormEvent) {
    e.preventDefault();
    if (!sectionName.trim()) return;
    await createSection.mutateAsync(sectionName.trim());
    setSectionName("");
    setAddingSection(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(sectionOrder, oldIndex, newIndex);
    setSectionOrder(nextOrder);
    nextOrder.forEach((sectionId, index) => updateSection.mutate({ sectionId, order: index }));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((sectionId) => {
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return null;
            return (
              <SortableSectionGroup
                key={section.id}
                projectId={project.id}
                sectionId={section.id}
                name={section.name}
                tasks={(grouped.get(section.id) ?? []).sort((a, b) => a.order - b.order)}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      {grouped.has(null) && (
        <SectionGroup
          projectId={project.id}
          sectionId={null}
          name="No section"
          tasks={(grouped.get(null) ?? []).sort((a, b) => a.order - b.order)}
        />
      )}

      {addingSection ? (
        <form onSubmit={handleAddSection} className="flex items-center gap-2 px-2">
          <input
            autoFocus
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            onBlur={() => !sectionName && setAddingSection(false)}
            placeholder="Section name"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
          />
        </form>
      ) : (
        <button
          onClick={() => setAddingSection(true)}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-slate-400 hover:text-slate-600"
        >
          <Plus size={15} /> Add section
        </button>
      )}
    </div>
  );
}

function SortableSectionGroup(props: { projectId: string; sectionId: string; name: string; tasks: Task[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.sectionId,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <SectionGroup {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function SectionGroup({
  projectId,
  sectionId,
  name,
  tasks,
  dragHandleProps,
}: {
  projectId: string;
  sectionId: string | null;
  name: string;
  tasks: Task[];
  dragHandleProps?: Record<string, unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(projectId);
  const openTask = useTaskPanelStore((s) => s.open);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const task = await createTask.mutateAsync({ title: title.trim(), sectionId: sectionId ?? undefined });
    setTitle("");
    setAdding(false);
    // Drop straight into the full editor so assignees, dates, etc. can be set immediately.
    openTask(task.id);
  }

  return (
    <div className="mb-6">
      <div className="mb-1 flex items-center gap-1 px-2">
        {dragHandleProps && (
          <button
            {...dragHandleProps}
            className="cursor-grab touch-none rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        )}
        <SectionHeader projectId={projectId} sectionId={sectionId} name={name} count={tasks.length} className="flex-1" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projectId={projectId} />
        ))}
        {tasks.length === 0 && !adding && (
          <p className="px-4 py-3 text-sm text-slate-400">No tasks yet</p>
        )}
        {adding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2 border-t border-slate-50 px-4 py-2">
            <Plus size={15} className="text-slate-300" />
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setAdding(false)}
              placeholder="Task name"
              className="flex-1 border-none bg-transparent text-sm focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-2 border-t border-slate-50 px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <Plus size={15} /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, projectId }: { task: Task; projectId: string }) {
  const updateTask = useUpdateTask(task.id, projectId);
  const openTask = useTaskPanelStore((s) => s.open);
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
        {!!task._count?.subtasks && (
          <span className="ml-2 text-xs font-normal text-slate-400">{task._count.subtasks} subtasks</span>
        )}
      </button>
      <PriorityBadge priority={task.priority} />
      {task.dueDate && (
        <span className={`text-xs ${overdue ? "font-medium text-red-600" : "text-slate-400"}`}>
          {formatDueDate(task.dueDate)}
        </span>
      )}
      {task.assignees?.length ? (
        <AssigneeAvatars assignees={task.assignees} size="sm" />
      ) : (
        <span className="h-6 w-6 rounded-full border border-dashed border-slate-200" />
      )}
    </div>
  );
}
