import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, UserPlus, X } from "lucide-react";
import Modal from "../common/Modal";
import Avatar from "../common/Avatar";
import {
  useUpdateProject,
  useDeleteProject,
  useAddProjectMember,
  useRemoveProjectMember,
} from "../../api/projects";
import { useWorkspaceTeams } from "../../api/workspaces";
import type { Project } from "../../types";

export default function ProjectSettingsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const navigate = useNavigate();

  const updateProject = useUpdateProject(project.id);
  const deleteProject = useDeleteProject(project.id, project.workspaceId);
  const addMember = useAddProjectMember(project.id);
  const removeMember = useRemoveProjectMember(project.id);
  const { data: teams } = useWorkspaceTeams(project.workspaceId);

  return (
    <Modal open title="Project settings" onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== project.name && updateProject.mutate({ name: name.trim() })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              description !== (project.description ?? "") && updateProject.mutate({ description })
            }
            rows={2}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Team</label>
          <select
            value={project.teamId ?? ""}
            onChange={(e) => updateProject.mutate({ teamId: e.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">No team — personal (only you and added members)</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — visible to this team
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Members</p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-100 p-1.5">
            {project.members?.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                <Avatar name={m.user.name} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} size="sm" />
                <span className="flex-1 truncate text-sm text-slate-700">{m.user.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    m.role === "OWNER" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {m.role === "OWNER" ? "Owner" : "Editor"}
                </span>
                {m.role !== "OWNER" && (
                  <button
                    onClick={() => removeMember.mutate(m.user.id)}
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!!project.invites?.length && (
            <div className="mt-2 space-y-1">
              {project.invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                  <Avatar name={inv.invitedUser.name} color={inv.invitedUser.avatarColor} imageUrl={inv.invitedUser.avatarUrl} size="sm" />
                  <span className="flex-1 truncate text-sm text-slate-500">{inv.invitedUser.name}</span>
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
            className="mt-2 flex gap-2"
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
        </div>

        <div className="border-t border-slate-100 pt-4">
          <button
            onClick={async () => {
              if (confirm(`Delete "${project.name}"? This deletes all its tasks permanently.`)) {
                await deleteProject.mutateAsync();
                onClose();
                navigate(`/w/${project.workspaceId}`);
              }
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
          >
            <Trash2 size={14} /> Delete project
          </button>
        </div>
      </div>
    </Modal>
  );
}
