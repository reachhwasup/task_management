import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useUpdateSection, useDeleteSection } from "../../api/projects";

interface SectionHeaderProps {
  projectId: string;
  sectionId: string | null;
  name: string;
  count: number;
  className?: string;
}

/** Editable section/column title — click to rename, "..." menu to delete.
 * `sectionId === null` is the synthetic "No section" bucket, which can't be
 * renamed or deleted since it isn't a real Section row. */
export default function SectionHeader({ projectId, sectionId, name, count, className }: SectionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [menuOpen, setMenuOpen] = useState(false);
  const updateSection = useUpdateSection(projectId);
  const deleteSection = useDeleteSection(projectId);
  const canEdit = sectionId !== null;

  function commitRename() {
    setEditing(false);
    if (!sectionId) return;
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      updateSection.mutate({ sectionId, name: trimmed });
    } else {
      setValue(name);
    }
  }

  return (
    <div className={`group flex min-w-0 items-center gap-1.5 ${className ?? ""}`}>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-sm font-semibold text-slate-700 focus:outline-none"
        />
      ) : (
        <button
          onClick={() => canEdit && setEditing(true)}
          className={`truncate text-sm font-semibold text-slate-600 ${canEdit ? "hover:text-slate-900" : "cursor-default"}`}
        >
          {name}
        </button>
      )}
      <span className="shrink-0 text-xs font-normal text-slate-400">{count}</span>

      {canEdit && (
        <div className="relative ml-auto shrink-0 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (confirm(`Delete "${name}"? Its tasks move to "No section".`)) {
                      deleteSection.mutate(sectionId);
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} /> Delete section
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
