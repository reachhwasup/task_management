import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth.store";
import { bootstrapAuth } from "./api/client";
import { useRealtimeConnection } from "./hooks/useSocket";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AppShell from "./components/layout/AppShell";
import WorkspaceGate from "./pages/WorkspaceGate";
import CreateWorkspacePage from "./pages/CreateWorkspacePage";
import WorkspaceOverviewPage from "./pages/WorkspaceOverviewPage";
import MyTasksPage from "./pages/MyTasksPage";
import TeamPage from "./pages/TeamPage";
import ProjectPage from "./pages/ProjectPage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, isBootstrapping } = useAuthStore();
  if (isBootstrapping) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
    </div>
  );
}

export default function App() {
  const { user, isBootstrapping } = useAuthStore();
  useRealtimeConnection();

  useEffect(() => {
    bootstrapAuth();
  }, []);

  if (isBootstrapping) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkspaceGate />} />
        <Route path="workspaces/new" element={<CreateWorkspacePage />} />
        <Route path="w/:workspaceId" element={<WorkspaceOverviewPage />} />
        <Route path="w/:workspaceId/my-tasks" element={<MyTasksPage />} />
        <Route path="w/:workspaceId/teams/:teamId" element={<TeamPage />} />
        <Route path="w/:workspaceId/projects/:projectId" element={<ProjectPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
