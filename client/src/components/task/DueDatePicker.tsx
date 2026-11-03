import { useState } from "react";
import { Calendar } from "lucide-react";
import { formatDueDate, isOverdue } from "../../utils/format";

interface DueDatePickerProps {
  dueDate?: string | null;
  completed?: boolean;
  onChange: (iso: string | null) => void;
  /** Which side the popover opens from. Use "right" near a panel's right edge so it doesn't overflow. */
  align?: "left" | "right";
}

export default function DueDatePicker({ dueDate, completed, onChange, align = "left" }: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const overdue = isOverdue(dueDate, completed);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={dueDate ? formatDueDate(dueDate) : "Set due date"}
        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs hover:ring-2 hover:ring-slate-200 ${
          dueDate ? (overdue ? "font-medium text-red-600" : "text-slate-500") : "text-slate-300"
        }`}
      >
        <Calendar size={13} />
        {dueDate && <span>{formatDueDate(dueDate)}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-6 z-20 rounded-lg border border-slate-200 bg-white p-2 shadow-lg ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <input
              type="date"
              autoFocus
              value={dueDate ? dueDate.slice(0, 10) : ""}
              onChange={(e) => {
                onChange(e.target.value ? new Date(e.target.value).toISOString() : null);
                setOpen(false);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:outline-none"
            />
            {dueDate && (
              <button
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="mt-1.5 block w-full text-left text-xs text-slate-400 hover:text-red-500"
              >
                Clear date
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
