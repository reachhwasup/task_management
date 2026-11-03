import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import Avatar from "../common/Avatar";
import type { User } from "../../types";

interface AssigneePickerProps {
  assignees: User[];
  candidates: User[];
  onChange: (userIds: string[]) => void;
  /** Icon-only trigger (avatar or placeholder circle, no name label) — for tight spaces like subtask rows. */
  compact?: boolean;
  /** Which side the dropdown opens from. Use "right" near a panel's right edge so it doesn't overflow. */
  align?: "left" | "right";
}

export default function AssigneePicker({
  assignees,
  candidates,
  onChange,
  compact = false,
  align = "left",
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(assignees.map((u) => u.id));

  const toggle = (userId: string) => {
    onChange(
      assignedIds.has(userId)
        ? assignees.filter((u) => u.id !== userId).map((u) => u.id)
        : [...assignees.map((u) => u.id), userId]
    );
  };

  const label =
    assignees.length === 0
      ? "Unassigned"
      : assignees.length === 1
        ? assignees[0].name
        : `${assignees[0].name} +${assignees.length - 1}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={assignees.length ? assignees.map((u) => u.name).join(", ") : "Assign"}
        className={
          compact
            ? "flex items-center rounded-full hover:ring-2 hover:ring-slate-200"
            : "flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-100"
        }
      >
        {assignees.length ? (
          <>
            <span className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((u) => (
                <Avatar key={u.id} name={u.name} color={u.avatarColor} imageUrl={u.avatarUrl} size={compact ? "xs" : "sm"} />
              ))}
            </span>
            {!compact && <span className="text-slate-700">{label}</span>}
          </>
        ) : (
          <>
            <span
              className={`flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 ${
                compact ? "h-5 w-5" : "h-6 w-6"
              }`}
            >
              <UserPlus size={compact ? 11 : 13} />
            </span>
            {!compact && <span className="text-slate-400">Unassigned</span>}
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-8 z-20 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {assignees.length > 0 && (
              <button
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
              >
                Unassign all
              </button>
            )}
            {/* Clicking toggles membership and keeps the menu open so several PICs can be picked in one go. */}
            {candidates.map((user) => (
              <button
                key={user.id}
                onClick={() => toggle(user.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  assignedIds.has(user.id) ? "bg-brand-50" : ""
                }`}
              >
                <Avatar name={user.name} color={user.avatarColor} imageUrl={user.avatarUrl} size="sm" />
                <span className="truncate text-slate-700">{user.name}</span>
                {assignedIds.has(user.id) && <Check size={14} className="ml-auto shrink-0 text-brand-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
