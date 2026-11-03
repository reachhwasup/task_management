import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Calendar, GanttChart, LayoutGrid, List, Settings, UserPlus } from "lucide-react";
import { useProject, useProjectTasks } from "../api/projects";
import { useProjectRoom } from "../hooks/useSocket";
import Avatar from "../components/common/Avatar";
import ListView from "../components/project/ListView";
import BoardView from "../components/project/BoardView";
import CalendarView from "../components/calendar/CalendarView";
import TimelineView from "../components/project/TimelineView";
import ProjectSettingsModal from "../components/project/ProjectSettingsModal";

type ViewMode = "list" | "board" | "calendar" | "timeline";

export default function ProjectPage() {
  const { projectId, workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as ViewMode) || "list";
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: project } = useProject(projectId);
  const { data: tasks } = useProjectTasks(projectId);
  useProjectRoom(projectId);

  if (!project || !tasks || !projectId || !workspaceId) return null;

  const setView = (v: ViewMode) => setSearchParams({ view: v });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {project.members?.slice(0, 5).map((m) => (
              <div key={m.id} className="ring-2 ring-white rounded-full">
                <Avatar name={m.user.name} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} size="sm" />
              </div>
            ))}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <UserPlus size={14} /> Share
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 bg-white px-6">
        <TabButton active={view === "list"} onClick={() => setView("list")} icon={<List size={14} />} label="List" />
        <TabButton
          active={view === "board"}
          onClick={() => setView("board")}
          icon={<LayoutGrid size={14} />}
          label="Board"
        />
        <TabButton
          active={view === "calendar"}
          onClick={() => setView("calendar")}
          icon={<Calendar size={14} />}
          label="Calendar"
        />
        <TabButton
          active={view === "timeline"}
          onClick={() => setView("timeline")}
          icon={<GanttChart size={14} />}
          label="Timeline"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "list" && <ListView project={project} tasks={tasks} />}
        {view === "board" && <BoardView project={project} tasks={tasks} />}
        {view === "calendar" && <CalendarView project={project} tasks={tasks} />}
        {view === "timeline" && <TimelineView project={project} tasks={tasks} />}
      </div>

      {settingsOpen && <ProjectSettingsModal project={project} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
