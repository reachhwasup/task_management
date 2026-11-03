import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, UserPlus, X } from "lucide-react";
import { useTeam, useAddTeamMember, useRemoveTeamMember } from "../api/teams";
import { useCreateProject } from "../api/workspaces";
import Avatar from "../components/common/Avatar";
import Modal from "../components/common/Modal";

export default function TeamPage() {
  const { teamId, workspaceId } = useParams();
  const { data: team } = useTeam(teamId);
  const addMember = useAddTeamMember(teamId ?? "");
  const removeMember = useRemoveTeamMember(teamId ?? "");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  if (!team || !workspaceId) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{team.name}</h1>
          {team.description && <p className="text-sm text-slate-500">{team.description}</p>}
        </div>
        <button
          onClick={() => setProjectModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={15} /> New project
        </button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Projects</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.projects?.map((project) => (
            <Link
              key={project.id}
              to={`/w/${workspaceId}/projects/${project.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                <p className="font-medium text-slate-800">{project.name}</p>
              </div>
            </Link>
          ))}
          {!team.projects?.length && <p className="text-sm text-slate-400">No projects yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <div className="rounded-lg border border-slate-200 bg-white">
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
              <Avatar name={m.user.name} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{m.user.name}</p>
                <p className="text-xs text-slate-400">{m.user.email}</p>
              </div>
              <button
                onClick={() => removeMember.mutate(m.user.id)}
                className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        {!!team.invites?.length && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-slate-500">Pending invites</p>
            {team.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                <Avatar name={inv.invitedUser.name} color={inv.invitedUser.avatarColor} imageUrl={inv.invitedUser.avatarUrl} size="sm" />
                <span className="flex-1 truncate text-sm text-slate-500">
                  {inv.invitedUser.name} <span className="text-xs text-slate-400">({inv.invitedUser.email})</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Invited
                </span>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteEmail.trim()) return;
            addMember.mutate(inviteEmail.trim(), { onSuccess: () => setInviteEmail("") });
          }}
          className="mt-3 flex max-w-md gap-2"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Invite by email, e.g. name@gmail.com"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={addMember.isPending || !inviteEmail.trim()}
            className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <UserPlus size={13} /> Invite
          </button>
        </form>
        {addMember.isError && (
          <p className="mt-1 text-xs text-red-600">
            {(addMember.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              "Could not send the invite"}
          </p>
        )}
      </section>

      {projectModalOpen && (
        <NewProjectModal
          workspaceId={workspaceId}
          teamId={team.id}
          onClose={() => setProjectModalOpen(false)}
        />
      )}
    </div>
  );
}

function NewProjectModal({
  workspaceId,
  teamId,
  onClose,
}: {
  workspaceId: string;
  teamId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const createProject = useCreateProject(workspaceId);

  return (
    <Modal open title="New project" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await createProject.mutateAsync({ name: name.trim(), teamId });
          onClose();
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProject.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}
