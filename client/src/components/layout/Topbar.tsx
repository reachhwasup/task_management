import { useState } from "react";
import { LogOut, UserCog } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useLogout } from "../../api/auth";
import Avatar from "../common/Avatar";
import ProfileModal from "../common/ProfileModal";
import NotificationsDropdown from "./NotificationsDropdown";

export default function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-4">
      <NotificationsDropdown />
      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full">
          <Avatar name={user.name} color={user.avatarColor} imageUrl={user.avatarUrl} size="md" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-10 z-20 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserCog size={15} />
                Edit profile
              </button>
              <button
                onClick={() => logout.mutate()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} />}
    </header>
  );
}
