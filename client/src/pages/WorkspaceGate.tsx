import { Navigate } from "react-router-dom";
import { useWorkspaces } from "../api/workspaces";

export default function WorkspaceGate() {
  const { data: workspaces, isLoading } = useWorkspaces();

  if (isLoading) return null;
  if (!workspaces?.length) return <Navigate to="/workspaces/new" replace />;
  return <Navigate to={`/w/${workspaces[0].id}`} replace />;
}
