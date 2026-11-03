import Avatar from "./Avatar";
import type { User } from "../../types";

interface AssigneeAvatarsProps {
  assignees?: { user: User }[];
  size?: "xs" | "sm";
  /** How many avatars to show before collapsing the rest into a "+N" bubble. */
  max?: number;
}

/** Read-only stacked avatars for a task's PICs, used in list/board/card rows. */
export default function AssigneeAvatars({ assignees, size = "sm", max = 3 }: AssigneeAvatarsProps) {
  if (!assignees?.length) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <span
      className="flex items-center -space-x-1.5"
      title={assignees.map((a) => a.user.name).join(", ")}
    >
      {shown.map(({ user }) => (
        <Avatar key={user.id} name={user.name} color={user.avatarColor} imageUrl={user.avatarUrl} size={size} />
      ))}
      {extra > 0 && (
        <span
          className={`flex items-center justify-center rounded-full bg-slate-200 font-medium text-slate-600 ring-1 ring-white ${
            size === "xs" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"
          }`}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
