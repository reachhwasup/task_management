import { FormEvent, useEffect, useState } from "react";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, GripVertical, Plus } from "lucide-react";
import type { Project, Task } from "../../types";
import { useCreateTask, useCreateSection, useUpdateSection } from "../../api/projects";
import { useReorderTasks, useUpdateTask } from "../../api/tasks";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import AssigneeAvatars from "../common/AssigneeAvatars";
import PriorityBadge from "../common/PriorityBadge";
import SectionHeader from "./SectionHeader";
import { formatDueDate, isOverdue } from "../../utils/format";

const NO_SECTION = "__none__";

export default function BoardView({ project, tasks }: { project: Project; tasks: Task[] }) {
  const sections = project.sections ?? [];
  const reorder = useReorderTasks(project.id);
  const updateSection = useUpdateSection(project.id);
  const createSection = useCreateSection(project.id);
  const [columns, setColumns] = useState<Record<string, Task[]>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnTitle, setActiveColumnTitle] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");

  useEffect(() => {
    const next: Record<string, Task[]> = {};
    for (const section of sections) next[section.id] = [];
    for (const task of tasks) {
      const key = task.sectionId ?? NO_SECTION;
      if (!next[key]) next[key] = [];
      next[key].push(task);
    }
    for (const key of Object.keys(next)) next[key].sort((a, b) => a.order - b.order);
    setColumns(next);
  }, [tasks, sections]);

  useEffect(() => {
    setSectionOrder(sections.map((s) => s.id));
  }, [sections]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // When dragging a column, only column containers should ever be valid drop
  // targets — otherwise closestCorners can resolve to a task card nested
  // inside another column, and `over.id` won't match any section id at all.
  const collisionDetection: CollisionDetection = (args) => {
    if (args.active.data.current?.type === "column") {
      const columnContainers = args.droppableContainers.filter(
        (c) => c.data.current?.type === "column"
      );
      return closestCorners({ ...args, droppableContainers: columnContainers });
    }
    return closestCorners(args);
  };

  const columnIds = [...sectionOrder, ...(columns[NO_SECTION]?.length ? [NO_SECTION] : [])];

  function findColumnOf(taskId: string): string | undefined {
    return Object.keys(columns).find((key) => columns[key].some((t) => t.id === taskId));
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "column") {
      const section = sections.find((s) => s.id === event.active.id);
      setActiveColumnTitle(section?.name ?? null);
      return;
    }
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type === "column") return; // columns only reorder on drop
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromCol = findColumnOf(activeId);
    const toCol = columnIds.includes(overId) ? overId : findColumnOf(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const fromItems = [...prev[fromCol]];
      const activeIndex = fromItems.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prev;
      const [moved] = fromItems.splice(activeIndex, 1);

      const toItems = [...(prev[toCol] ?? [])];
      const overIndex = toItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex === -1 ? toItems.length : overIndex;
      toItems.splice(insertAt, 0, moved);

      return { ...prev, [fromCol]: fromItems, [toCol]: toItems };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (event.active.data.current?.type === "column") {
      setActiveColumnTitle(null);
      if (!over || active.id === over.id) return;
      const oldIndex = sectionOrder.indexOf(String(active.id));
      const newIndex = sectionOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const nextOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      setSectionOrder(nextOrder);
      nextOrder.forEach((sectionId, index) => updateSection.mutate({ sectionId, order: index }));
      return;
    }

    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const fromCol = findColumnOf(activeId);
    const toCol = columnIds.includes(overId) ? overId : findColumnOf(overId) ?? fromCol;

    setColumns((prev) => {
      let next = prev;
      if (fromCol && toCol && fromCol === toCol) {
        const items = [...prev[fromCol]];
        const activeIndex = items.findIndex((t) => t.id === activeId);
        const overIndex = items.findIndex((t) => t.id === overId);
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          const [moved] = items.splice(activeIndex, 1);
          items.splice(overIndex, 0, moved);
          next = { ...prev, [fromCol]: items };
        }
      }

      const items = Object.entries(next).flatMap(([sectionId, colTasks]) =>
        colTasks.map((t, index) => ({
          id: t.id,
          sectionId: sectionId === NO_SECTION ? null : sectionId,
          order: index,
        }))
      );
      reorder.mutate(items);
      return next;
    });
  }

  async function handleAddSection(e: FormEvent) {
    e.preventDefault();
    if (!sectionName.trim()) return;
    await createSection.mutateAsync(sectionName.trim());
    setSectionName("");
    setAddingSection(false);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto px-6 py-4">
        <SortableContext items={sectionOrder} strategy={horizontalListSortingStrategy}>
          {sectionOrder.map((sectionId) => {
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return null;
            return (
              <SortableColumn
                key={section.id}
                sectionId={section.id}
                title={section.name}
                projectId={project.id}
                tasks={columns[section.id] ?? []}
              />
            );
          })}
        </SortableContext>

        {!!columns[NO_SECTION]?.length && (
          <UnsectionedColumn projectId={project.id} tasks={columns[NO_SECTION] ?? []} />
        )}

        <div className="w-64 shrink-0">
          {addingSection ? (
            <form onSubmit={handleAddSection} className="rounded-lg bg-slate-100/70 p-2">
              <input
                autoFocus
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                onBlur={() => !sectionName && setAddingSection(false)}
                placeholder="Section name"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-100/70 hover:text-slate-600"
            >
              <Plus size={15} /> Add section
            </button>
          )}
        </div>
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} dragging />}
        {activeColumnTitle && (
          <div className="w-72 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200">
            {activeColumnTitle}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SortableColumn({
  sectionId,
  title,
  projectId,
  tasks,
}: {
  sectionId: string;
  title: string;
  projectId: string;
  tasks: Task[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: sectionId,
    data: { type: "column" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <ColumnBody
        sectionId={sectionId}
        title={title}
        projectId={projectId}
        tasks={tasks}
        isOver={isOver}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function UnsectionedColumn({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: NO_SECTION });
  return (
    <div ref={setNodeRef}>
      <ColumnBody sectionId={null} title="No section" projectId={projectId} tasks={tasks} isOver={isOver} />
    </div>
  );
}

function ColumnBody({
  sectionId,
  title,
  projectId,
  tasks,
  isOver,
  dragHandleProps,
}: {
  sectionId: string | null;
  title: string;
  projectId: string;
  tasks: Task[];
  isOver: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const createTask = useCreateTask(projectId);
  const openTask = useTaskPanelStore((s) => s.open);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const task = await createTask.mutateAsync({ title: taskTitle.trim(), sectionId: sectionId ?? undefined });
    setTaskTitle("");
    setAdding(false);
    // Drop straight into the full editor so assignees, dates, etc. can be set immediately.
    openTask(task.id);
  }

  return (
    <div className={`flex w-72 shrink-0 flex-col rounded-lg bg-slate-100/70 ${isOver ? "ring-2 ring-brand-300" : ""}`}>
      <div className="flex items-center gap-1 px-2 py-2.5">
        {dragHandleProps && (
          <button
            {...dragHandleProps}
            className="cursor-grab touch-none rounded p-0.5 text-slate-300 hover:bg-slate-200/60 hover:text-slate-500 active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        )}
        <SectionHeader projectId={projectId} sectionId={sectionId} name={title} count={tasks.length} className="flex-1" />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </SortableContext>
      </div>
      <div className="px-2 pb-2">
        {adding ? (
          <form onSubmit={handleAdd} className="rounded-md bg-white p-2 shadow-sm">
            <input
              autoFocus
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onBlur={() => !taskTitle && setAdding(false)}
              placeholder="Task name"
              className="w-full border-none text-sm focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
          >
            <Plus size={13} /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

function SortableTaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "opacity-40" : ""}>
      <TaskCard task={task} projectId={projectId} />
    </div>
  );
}

function TaskCard({ task, projectId, dragging }: { task: Task; projectId?: string; dragging?: boolean }) {
  const openTask = useTaskPanelStore((s) => s.open);
  const updateTask = useUpdateTask(task.id, projectId ?? task.projectId);
  const overdue = isOverdue(task.dueDate, task.completed);

  return (
    <div
      className={`space-y-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200/70 ${
        dragging ? "shadow-lg" : "hover:ring-brand-200"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateTask.mutate({ completed: !task.completed });
          }}
          className={`mt-0.5 shrink-0 ${task.completed ? "text-emerald-600" : "text-slate-300"}`}
        >
          {task.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>
        <button
          onClick={() => openTask(task.id)}
          className={`flex-1 text-left text-sm ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}
        >
          {task.title}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {task.dueDate && (
            <span className={`text-xs ${overdue ? "font-medium text-red-600" : "text-slate-400"}`}>
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
        <AssigneeAvatars assignees={task.assignees} size="xs" />
      </div>
    </div>
  );
}
