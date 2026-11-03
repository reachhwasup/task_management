import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useWorkspaces, useWorkspaceTeams, useWorkspaceProjects, useCreateTeam, useCreateProject } from "../../api/workspaces";
import { useUpdateTeam, useDeleteTeam } from "../../api/teams";
import { useUpdateProject, useDeleteProject } from "../../api/projects";
import Modal from "../common/Modal";
import type { Project, Team } from "../../types";

export default function Sidebar() {
  const { workspaceId, projectId, teamId } = useParams();
  const navigate = useNavigate();
  const { data: workspaces } = useWorkspaces();
  const { data: teams } = useWorkspaceTeams(workspaceId);
  const { data: projects } = useWorkspaceProjects(workspaceId);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState<
    { kind: "team" } | { kind: "project"; teamId?: string } | null
  >(null);

  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId);
  const untetheredProjects = projects?.filter((p) => !p.teamId) ?? [];
  // Team projects the user can access without being in the team (added as a
  // project member) — their team isn't rendered, so list them separately.
  const visibleTeamIds = new Set((teams ?? []).map((t) => t.id));
  const sharedProjects = projects?.filter((p) => p.teamId && !visibleTeamIds.has(p.teamId)) ?? [];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="relative border-b border-slate-100 p-3">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-100"
        >
          <span className="truncate font-semibold text-slate-800">
            {currentWorkspace?.name ?? "Select workspace"}
          </span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>
        {switcherOpen && (
          <div className="absolute left-3 right-3 top-14 z-20 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {workspaces?.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setSwitcherOpen(false);
                  navigate(`/w/${w.id}`);
                }}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  w.id === workspaceId ? "font-medium text-brand-700" : "text-slate-700"
                }`}
              >
                {w.name}
              </button>
            ))}
            <button
              onClick={() => {
                setSwitcherOpen(false);
                navigate("/workspaces/new");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-brand-600 hover:bg-slate-50"
            >
              + New workspace
            </button>
          </div>
        )}
      </div>

      {workspaceId && (
        <nav className="flex-1 overflow-y-auto p-3 text-sm">
          <Link
            to={`/w/${workspaceId}/my-tasks`}
            className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            <CheckSquare size={16} />
            My tasks
          </Link>
          <Link
            to={`/w/${workspaceId}`}
            className="mb-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            <Layers size={16} />
            Overview
          </Link>

          <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Teams</span>
            <button onClick={() => setCreateOpen({ kind: "team" })} className="rounded p-0.5 hover:bg-slate-100">
              <Plus size={14} />
            </button>
          </div>
          {teams?.map((team) => (
            <TeamNavItem
              key={team.id}
              team={team}
              workspaceId={workspaceId}
              activeTeamId={teamId}
              activeProjectId={projectId}
              onNewProject={() => setCreateOpen({ kind: "project", teamId: team.id })}
            />
          ))}

          <div className="mb-1 mt-4 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>My projects</span>
            <button onClick={() => setCreateOpen({ kind: "project" })} className="rounded p-0.5 hover:bg-slate-100">
              <Plus size={14} />
            </button>
          </div>
          {untetheredProjects.map((p) => (
            <ProjectNavItem key={p.id} project={p} workspaceId={workspaceId} active={p.id === projectId} />
          ))}
          {untetheredProjects.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">No personal projects yet</p>
          )}

          {sharedProjects.length > 0 && (
            <>
              <div className="mb-1 mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Shared with me
              </div>
              {sharedProjects.map((p) => (
                <ProjectNavItem key={p.id} project={p} workspaceId={workspaceId} active={p.id === projectId} />
              ))}
            </>
          )}
        </nav>
      )}

      {workspaceId && createOpen?.kind === "team" && (
        <CreateTeamModal workspaceId={workspaceId} onClose={() => setCreateOpen(null)} />
      )}
      {workspaceId && createOpen?.kind === "project" && (
        <CreateProjectModal
          workspaceId={workspaceId}
          teams={teams ?? []}
          initialTeamId={createOpen.teamId}
          onClose={() => setCreateOpen(null)}
        />
      )}
    </aside>
  );
}

function TeamNavItem({
  team,
  workspaceId,
  activeTeamId,
  activeProjectId,
  onNewProject,
}: {
  team: Team;
  workspaceId: string;
  activeTeamId?: string;
  activeProjectId?: string;
  onNewProject: () => void;
}) {
  const [open, setOpen] = useState(team.id === activeTeamId || team.projects?.some((p) => p.id === activeProjectId));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const navigate = useNavigate();
  const updateTeam = useUpdateTeam(team.id);
  const deleteTeam = useDeleteTeam(team.id);

  const saveRename = () => {
    if (name.trim() && name.trim() !== team.name) updateTeam.mutate({ name: name.trim() });
    setEditing(false);
  };

  return (
    <div>
      <div className="group flex items-center gap-1">
        <button onClick={() => setOpen((v) => !v)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 rounded-md border border-brand-300 px-1.5 py-1 text-sm focus:outline-none"
          />
        ) : (
          <Link
            to={`/w/${workspaceId}/teams/${team.id}`}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 ${
              team.id === activeTeamId ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Users size={15} />
            <span className="truncate">{team.name}</span>
          </Link>
        )}
        <button
          onClick={onNewProject}
          title={`New project in ${team.name}`}
          className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
        >
          <Plus size={14} />
        </button>
        <RowActions
          onRename={() => {
            setName(team.name);
            setEditing(true);
          }}
          onDelete={async () => {
            if (
              confirm(
                `Delete team "${team.name}"? Its projects will not be deleted — they become standalone projects.`
              )
            ) {
              await deleteTeam.mutateAsync();
              if (team.id === activeTeamId) navigate(`/w/${workspaceId}`);
            }
          }}
        />
      </div>
      {open && (
        <div className="ml-6 border-l border-slate-100 pl-2">
          {team.projects?.map((p) => (
            <ProjectNavItem
              key={p.id}
              project={p}
              workspaceId={workspaceId}
              active={p.id === activeProjectId}
              nested
            />
          ))}
          {(!team.projects || team.projects.length === 0) && (
            <p className="px-2 py-1 text-xs text-slate-400">No projects yet</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectNavItem({
  project,
  workspaceId,
  active,
  nested = false,
}: {
  project: Project;
  workspaceId: string;
  active: boolean;
  nested?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const navigate = useNavigate();
  const updateProject = useUpdateProject(project.id);
  const deleteProject = useDeleteProject(project.id, workspaceId);

  const saveRename = () => {
    if (name.trim() && name.trim() !== project.name) updateProject.mutate({ name: name.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveRename();
          if (e.key === "Escape") setEditing(false);
        }}
        className="my-0.5 w-full rounded-md border border-brand-300 px-2 py-1 text-sm focus:outline-none"
      />
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <Link
        to={`/w/${workspaceId}/projects/${project.id}`}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 ${
          active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        {nested ? (
          <Folder size={14} />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
        )}
        <span className={`truncate ${nested ? "text-[13px]" : ""}`}>{project.name}</span>
      </Link>
      <RowActions
        onRename={() => {
          setName(project.name);
          setEditing(true);
        }}
        onDelete={async () => {
          if (confirm(`Delete "${project.name}"? This deletes all its tasks permanently.`)) {
            await deleteProject.mutateAsync();
            if (active) navigate(`/w/${workspaceId}`);
          }
        }}
      />
    </div>
  );
}

/** Hover-revealed "…" menu with Rename / Delete, shared by team and project rows. */
function RowActions({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rounded p-0.5 text-slate-400 hover:bg-slate-100 group-hover:opacity-100 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                onRename();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateTeamModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const createTeam = useCreateTeam(workspaceId);

  return (
    <Modal open title="New team" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await createTeam.mutateAsync({ name: name.trim() });
          onClose();
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTeam.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Create team
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateProjectModal({
  workspaceId,
  teams,
  initialTeamId,
  onClose,
}: {
  workspaceId: string;
  teams: Team[];
  initialTeamId?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(initialTeamId ?? "");
  const navigate = useNavigate();
  const createProject = useCreateProject(workspaceId);

  return (
    <Modal open title="New project" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const project = await createProject.mutateAsync({
            name: name.trim(),
            teamId: teamId || undefined,
          });
          onClose();
          navigate(`/w/${workspaceId}/projects/${project.id}`);
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
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Team
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">No team — personal (only you and added members)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — visible to this team
              </option>
            ))}
          </select>
        </div>
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
