import { FormEvent, useState } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { useUpdateProfile } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";
import type { User } from "../../types";

const COLOR_PALETTE = [
  "#6366f1",
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

export default function ProfileModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const updateProfile = useUpdateProfile();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!name.trim()) {
      setError("Name can't be empty");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: name.trim(), avatarColor });
      setSuccess(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update profile"));
    }
  }

  return (
    <Modal open title="Edit profile" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={name || user.name} color={avatarColor} imageUrl={user.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{name || user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            This is the name teammates see everywhere — on tasks, comments, and mentions.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Avatar color
            {user.avatarUrl && <span className="font-normal text-slate-400"> (used if your photo doesn't load)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${
                  avatarColor === color ? "ring-2 ring-slate-400" : ""
                }`}
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Profile updated.</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {updateProfile.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
