import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "../../api/notifications";
import {
  useAcceptInvite,
  useDeclineInvite,
  useAcceptProjectInvite,
  useDeclineProjectInvite,
  useAcceptTeamInvite,
  useDeclineTeamInvite,
} from "../../api/invites";
import { useTaskPanelStore } from "../../store/taskPanel.store";
import Avatar from "../common/Avatar";
import { timeAgo } from "../../utils/format";
import type { Notification } from "../../types";

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const { data: count } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();
  const acceptProjectInvite = useAcceptProjectInvite();
  const declineProjectInvite = useDeclineProjectInvite();
  const acceptTeamInvite = useAcceptTeamInvite();
  const declineTeamInvite = useDeclineTeamInvite();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const openTask = useTaskPanelStore((s) => s.open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const inviteTypes = ["WORKSPACE_INVITE", "PROJECT_INVITE", "TEAM_INVITE"];

  function handleClick(n: Notification) {
    if (inviteTypes.includes(n.type)) return; // handled by their own buttons, not click-to-navigate rows
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.projectId) {
      navigate(`/w/${workspaceId}/projects/${n.projectId}`);
    } else if (n.workspaceId) {
      navigate(`/w/${n.workspaceId}`);
    }
    // The task panel is a global overlay (rendered in AppShell), so it opens
    // fine alongside the navigation above rather than needing its own route.
    if (n.taskId) openTask(n.taskId);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
      >
        <Bell size={18} />
        {!!count && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 max-h-[70vh] w-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            </div>
            {!notifications?.length && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up.</p>
            )}
            {notifications?.map((n) => {
              // Each invite kind pairs its own id field with its own accept/decline mutations.
              const invite =
                n.type === "WORKSPACE_INVITE" && n.inviteId
                  ? { id: n.inviteId, accept: acceptInvite, decline: declineInvite }
                  : n.type === "PROJECT_INVITE" && n.projectInviteId
                    ? { id: n.projectInviteId, accept: acceptProjectInvite, decline: declineProjectInvite }
                    : n.type === "TEAM_INVITE" && n.teamInviteId
                      ? { id: n.teamInviteId, accept: acceptTeamInvite, decline: declineTeamInvite }
                      : null;

              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                    !inviteTypes.includes(n.type) ? "cursor-pointer" : ""
                  } ${n.read ? "" : "bg-brand-50/40"}`}
                >
                  <Avatar name={n.actor?.name ?? "System"} color={n.actor?.avatarColor} imageUrl={n.actor?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{n.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
                    {invite && !n.read && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            invite.accept.mutate(invite.id);
                            markRead.mutate(n.id);
                          }}
                          disabled={invite.accept.isPending || invite.decline.isPending}
                          className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          onClick={() => {
                            invite.decline.mutate(invite.id);
                            markRead.mutate(n.id);
                          }}
                          disabled={invite.accept.isPending || invite.decline.isPending}
                          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X size={12} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
