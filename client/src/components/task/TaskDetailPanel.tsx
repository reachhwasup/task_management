import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, CornerDownRight, Plus, Trash2, X } from "lucide-react";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import { useTask, useUpdateTask, useDeleteTask, useCreateSubtask, useAddComment } from "../../api/tasks";
import { useAddTaskTag, useRemoveTaskTag } from "../../api/tasks";
import { useProject } from "../../api/projects";
import { useWorkspaceTags } from "../../api/workspaces";
import { useAuthStore } from "../../store/auth.store";
import Avatar from "../common/Avatar";
import AssigneePicker from "./AssigneePicker";
import DueDatePicker from "./DueDatePicker";
import CommentComposer from "./CommentComposer";
import { describeActivity } from "../../utils/activity";
import { splitContentByMentions } from "../../utils/mentions";
import { timeAgo } from "../../utils/format";
import type { Comment, Priority, Task, User } from "../../types";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function TaskDetailPanel() {
  const { openTaskId, close, open } = useTaskPanelStore();

  if (!openTaskId) return null;
  return <PanelContent key={openTaskId} taskId={openTaskId} onClose={close} onOpenTask={open} />;
}

function PanelContent({
  taskId,
  onClose,
  onOpenTask,
}: {
  taskId: string;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const { data: task } = useTask(taskId);
  const { data: project } = useProject(task?.projectId);
  const { data: tags } = useWorkspaceTags(project?.workspaceId);
  const { data: parentTask } = useTask(task?.parentTaskId ?? undefined);
  const currentUser = useAuthStore((s) => s.user);

  const updateTask = useUpdateTask(taskId, task?.projectId ?? "");
  const deleteTask = useDeleteTask(taskId, task?.projectId ?? "", task?.parentTaskId);
  const createSubtask = useCreateSubtask(taskId, task?.projectId ?? "");
  const addComment = useAddComment(taskId);
  const addTag = useAddTaskTag(taskId);
  const removeTag = useRemoveTaskTag(taskId);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
  }, [task?.id, task?.title, task?.description]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!task) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
        <div className="h-full w-full max-w-xl bg-white shadow-2xl" />
      </div>
    );
  }

  const candidates = (project?.members ?? []).map((m) => m.user);
  const appliedTagIds = new Set((task.tags ?? []).map((t) => t.tagId));
  const availableTags = (tags ?? []).filter((t) => !appliedTagIds.has(t.id));

  async function handleAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    await createSubtask.mutateAsync(subtaskTitle.trim());
    setSubtaskTitle("");
  }

  const commentThreads = groupCommentThreads(task.comments ?? []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <button
            onClick={() => updateTask.mutate({ completed: !task.completed })}
            className={`flex items-center gap-2 text-sm font-medium ${
              task.completed ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            {task.completed ? "Completed" : "Mark complete"}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                if (confirm("Delete this task? This cannot be undone.")) {
                  await deleteTask.mutateAsync();
                  onClose();
                }
              }}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {task.parentTaskId && (
          <button
            onClick={() => onOpenTask(task.parentTaskId!)}
            className="flex items-center gap-1.5 border-b border-slate-100 px-5 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-brand-700"
          >
            <ArrowLeft size={13} />
            Back to {parentTask ? `"${parentTask.title}"` : "main task"}
          </button>
        )}

        <div className="flex-1 space-y-6 px-5 py-4">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && updateTask.mutate({ title: title.trim() })}
            rows={1}
            className={`w-full resize-none border-none text-xl font-semibold text-slate-900 focus:outline-none ${
              task.completed ? "text-slate-400 line-through" : ""
            }`}
          />

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Field label="Assignees">
              <AssigneePicker
                assignees={(task.assignees ?? []).map((a) => a.user)}
                candidates={candidates}
                onChange={(assigneeIds) => updateTask.mutate({ assigneeIds })}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                onChange={(e) =>
                  updateTask.mutate({
                    dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
              />
            </Field>
            <Field label="Priority">
              <select
                value={task.priority}
                onChange={(e) => updateTask.mutate({ priority: e.target.value as Priority })}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0] + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags?.map((t) => (
                <span
                  key={t.tagId}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: t.tag.color }}
                >
                  {t.tag.name}
                  <button onClick={() => removeTag.mutate(t.tagId)} className="hover:opacity-70">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setTagMenuOpen((v) => !v)}
                  className="flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  <Plus size={11} /> Tag
                </button>
                {tagMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTagMenuOpen(false)} />
                    <div className="absolute left-0 top-7 z-20 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {availableTags.length === 0 && (
                        <p className="px-3 py-2 text-xs text-slate-400">No more tags</p>
                      )}
                      {availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            addTag.mutate(tag.id);
                            setTagMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? "") && updateTask.mutate({ description })}
              placeholder="Add a description..."
              rows={3}
              className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Subtasks {task._count ? `(${task._count.subtasks})` : ""}
            </p>
            <div className="space-y-1">
              {task.subtasks?.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  projectId={task.projectId}
                  candidates={candidates}
                  onOpen={onOpenTask}
                />
              ))}
            </div>
            <form onSubmit={handleAddSubtask} className="mt-1.5 flex items-center gap-2">
              <Plus size={14} className="text-slate-400" />
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Add subtask"
                className="flex-1 border-none bg-transparent text-sm text-slate-700 focus:outline-none"
              />
            </form>
          </div>

          <div>
            <div className="mb-3 flex gap-1 border-b border-slate-100">
              {(["comments", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    activeTab === tab
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab === "comments" ? `Comments (${task.comments?.length ?? 0})` : "Activity"}
                </button>
              ))}
            </div>

            {activeTab === "comments" ? (
              <>
                <div className="space-y-3">
                  {commentThreads.length === 0 && (
                    <p className="text-xs text-slate-400">No comments yet.</p>
                  )}
                  {commentThreads.map(({ root, replies }) => (
                    <div key={root.id} className="space-y-2">
                      <CommentBubble comment={root} onReply={setReplyingTo} />
                      {replies.length > 0 && (
                        <div className="ml-8 space-y-2 border-l border-slate-100 pl-3">
                          {replies.map((reply) => (
                            <CommentBubble key={reply.id} comment={reply} onReply={setReplyingTo} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <CommentComposer
                    candidates={candidates}
                    currentUser={currentUser}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    onSubmit={async ({ content, mentionedUserIds }) => {
                      await addComment.mutateAsync({
                        content,
                        parentCommentId: replyingTo?.id,
                        mentionedUserIds,
                      });
                      setReplyingTo(null);
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {!task.activities?.length && <p className="text-xs text-slate-400">No activity yet.</p>}
                {task.activities?.map((a) => (
                  <div key={`a-${a.id}`} className="flex items-center gap-2.5 text-xs text-slate-400">
                    <Avatar name={a.user.name} color={a.user.avatarColor} imageUrl={a.user.avatarUrl} size="xs" />
                    <span>{describeActivity(a)}</span>
                    <span>·</span>
                    <span>{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Groups a flat comment list into root comments + their replies (any depth flattened one level under the root). */
function groupCommentThreads(comments: Comment[]): { root: Comment; replies: Comment[] }[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  function findRoot(comment: Comment): Comment {
    let current = comment;
    while (current.parentCommentId) {
      const parent = byId.get(current.parentCommentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const threads = new Map<string, { root: Comment; replies: Comment[] }>();
  for (const comment of comments) {
    const root = findRoot(comment);
    if (!threads.has(root.id)) threads.set(root.id, { root, replies: [] });
    if (comment.id !== root.id) threads.get(root.id)!.replies.push(comment);
  }
  for (const thread of threads.values()) {
    thread.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return [...threads.values()].sort((a, b) => a.root.createdAt.localeCompare(b.root.createdAt));
}

function CommentBubble({ comment, onReply }: { comment: Comment; onReply: (comment: Comment) => void }) {
  const segments = splitContentByMentions(comment.content, comment.mentions);

  return (
    <div className="flex gap-2.5">
      <Avatar name={comment.user.name} color={comment.user.avatarColor} imageUrl={comment.user.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">{comment.user.name}</span>
            <span className="text-[11px] text-slate-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
            {segments.map((seg, i) =>
              seg.isMention ? (
                <span key={i} className="font-medium text-brand-700">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </p>
        </div>
        <button
          onClick={() => onReply(comment)}
          className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-700"
        >
          <CornerDownRight size={11} /> Reply
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function SubtaskRow({
  subtask,
  projectId,
  candidates,
  onOpen,
}: {
  subtask: Task;
  projectId: string;
  candidates: User[];
  onOpen: (id: string) => void;
}) {
  const updateSubtask = useUpdateTask(subtask.id, projectId);

  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
      <button
        onClick={() => updateSubtask.mutate({ completed: !subtask.completed })}
        className={subtask.completed ? "text-emerald-600" : "text-slate-300"}
      >
        {subtask.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>
      <button
        onClick={() => onOpen(subtask.id)}
        className={`flex-1 truncate text-left text-sm ${
          subtask.completed ? "text-slate-400 line-through" : "text-slate-700"
        }`}
      >
        {subtask.title}
      </button>
      {/* PIC (assignee) and schedule (due date) — settable inline without opening the subtask. */}
      <DueDatePicker
        dueDate={subtask.dueDate}
        completed={subtask.completed}
        align="right"
        onChange={(dueDate) => updateSubtask.mutate({ dueDate })}
      />
      <AssigneePicker
        assignees={(subtask.assignees ?? []).map((a) => a.user)}
        candidates={candidates}
        compact
        align="right"
        onChange={(assigneeIds) => updateSubtask.mutate({ assigneeIds })}
      />
    </div>
  );
}
