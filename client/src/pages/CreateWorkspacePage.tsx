import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateWorkspace } from "../api/workspaces";
import { apiErrorMessage } from "../api/client";

export default function CreateWorkspacePage() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const createWorkspace = useCreateWorkspace();
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const workspace = await createWorkspace.mutateAsync(name.trim());
      navigate(`/w/${workspace.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create workspace"));
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Create a workspace</h1>
        <p className="mb-6 text-sm text-slate-500">
          A workspace holds your teams, projects, and tasks.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Inc"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createWorkspace.isPending}
            className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Create workspace
          </button>
        </form>
      </div>
    </div>
  );
}
