import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Folder, Plus, Users } from "lucide-react";
import { useWorkspace, useWorkspaceMembers, useAddWorkspaceMember } from "../api/workspaces";
import { useWorkspaceInvites } from "../api/invites";
import Avatar from "../components/common/Avatar";
import Modal from "../components/common/Modal";
import { apiErrorMessage } from "../api/client";
import { timeAgo } from "../utils/format";

export default function WorkspaceOverviewPage() {
  const { workspaceId } = useParams();
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const { data: pendingInvites } = useWorkspaceInvites(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!workspace) return null;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{workspace.name}</h1>
          <p className="text-sm text-slate-500">
            {members?.length ?? 0} member{members?.length === 1 ? "" : "s"} · {workspace.role?.toLowerCase()}
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={15} /> Invite member
        </button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Users size={15} /> Teams
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.teams?.map((team) => (
            <Link
              key={team.id}
              to={`/w/${workspaceId}/teams/${team.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
            >
              <p className="font-medium text-slate-800">{team.name}</p>
              <p className="mt-1 text-xs text-slate-400">{team.members.length} members</p>
            </Link>
          ))}
          {!workspace.teams?.length && <p className="text-sm text-slate-400">No teams yet.</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Folder size={15} /> Projects
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.projects?.map((project) => (
            <Link
              key={project.id}
              to={`/w/${workspaceId}/projects/${project.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                <p className="font-medium text-slate-800">{project.name}</p>
              </div>
              {project.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{project.description}</p>
              )}
            </Link>
          ))}
          {!workspace.projects?.length && <p className="text-sm text-slate-400">No projects yet.</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <div className="rounded-lg border border-slate-200 bg-white">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
              <Avatar name={m.user.name} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{m.user.name}</p>
                <p className="text-xs text-slate-400">{m.user.email}</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {!!pendingInvites?.length && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending invites
          </h2>
          <div className="rounded-lg border border-slate-200 bg-white">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                <Avatar name={invite.invitedUser.name} color={invite.invitedUser.avatarColor} imageUrl={invite.invitedUser.avatarUrl} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{invite.invitedUser.name}</p>
                  <p className="text-xs text-slate-400">{invite.invitedUser.email}</p>
                </div>
                <span className="text-xs text-slate-400">Invited {timeAgo(invite.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {workspaceId && inviteOpen && (
        <InviteModal workspaceId={workspaceId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function InviteModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const addMember = useAddWorkspaceMember(workspaceId);

  return (
    <Modal open title="Invite a member" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSuccess("");
          try {
            await addMember.mutateAsync(email.trim());
            setSuccess(`Invite sent to ${email} — they'll need to accept it before joining.`);
            setEmail("");
          } catch (err) {
            setError(apiErrorMessage(err, "Could not add member"));
          }
        }}
        className="space-y-3"
      >
        <p className="text-sm text-slate-500">
          They need an existing account. Ask them to sign up first if they don't have one.
        </p>
        <input
          autoFocus
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Done
          </button>
          <button
            type="submit"
            disabled={addMember.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add member
          </button>
        </div>
      </form>
    </Modal>
  );
}
