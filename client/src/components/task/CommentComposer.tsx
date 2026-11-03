import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import Avatar from "../common/Avatar";
import { detectMentionTrigger } from "../../utils/mentions";
import type { Comment, User } from "../../types";

interface CommentComposerProps {
  candidates: User[];
  currentUser?: User | null;
  replyingTo?: Comment | null;
  onCancelReply: () => void;
  onSubmit: (input: { content: string; mentionedUserIds: string[] }) => Promise<unknown>;
}

export default function CommentComposer({
  candidates,
  currentUser,
  replyingTo,
  onCancelReply,
  onSubmit,
}: CommentComposerProps) {
  const [text, setText] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [trigger, setTrigger] = useState<{ query: string; start: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    return candidates.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [trigger, candidates]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setText(value);
    const cursor = e.target.selectionStart ?? value.length;
    setTrigger(detectMentionTrigger(value, cursor));
  }

  function selectMention(user: User) {
    if (!trigger) return;
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, trigger.start);
    const after = text.slice(cursor);
    const insertion = `@${user.name} `;
    const next = `${before}${insertion}${after}`;
    setText(next);
    setMentionedIds((prev) => new Set(prev).add(user.id));
    setTrigger(null);

    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (trigger && suggestions.length > 0 && e.key === "Enter") {
      e.preventDefault();
      selectMention(suggestions[0]);
    } else if (e.key === "Escape" && trigger) {
      setTrigger(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSubmit({ content: text.trim(), mentionedUserIds: [...mentionedIds] });
    setText("");
    setMentionedIds(new Set());
    setTrigger(null);
  }

  return (
    <div>
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
          <span>
            Replying to <span className="font-medium text-slate-700">{replyingTo.user.name}</span>
          </span>
          <button onClick={onCancelReply} className="rounded p-0.5 hover:bg-slate-200">
            <X size={12} />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2.5">
        {currentUser && <Avatar name={currentUser.name} color={currentUser.avatarColor} imageUrl={currentUser.avatarUrl} size="sm" />}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setTrigger(null), 150)}
            placeholder={replyingTo ? `Reply to ${replyingTo.user.name}...` : "Add a comment... (@ to mention)"}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          />
          {trigger && suggestions.length > 0 && (
            <div className="absolute bottom-9 left-0 z-20 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {suggestions.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(user);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <Avatar name={user.name} color={user.avatarColor} imageUrl={user.avatarUrl} size="sm" />
                  <span className="truncate text-slate-700">{user.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Post
        </button>
      </form>
    </div>
  );
}
