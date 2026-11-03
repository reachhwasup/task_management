import type { CommentMention } from "../types";

export interface MentionSegment {
  text: string;
  isMention: boolean;
}

/** Splits comment content into plain-text and mention segments so mentioned names can be styled. */
export function splitContentByMentions(content: string, mentions?: CommentMention[]): MentionSegment[] {
  if (!mentions?.length) return [{ text: content, isMention: false }];

  const needles = [...new Set(mentions.map((m) => `@${m.user.name}`))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${needles.map(escapeRegExp).join("|")})`, "g");

  return content
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, isMention: needles.includes(part) }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MentionTrigger {
  query: string;
  start: number;
}

/** Detects an in-progress "@partial" token right before the cursor, or null if none. */
export function detectMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  const uptoCursor = text.slice(0, cursor);
  const match = uptoCursor.match(/(?:^|\s)@([a-zA-Z0-9_.'-]*)$/);
  if (!match) return null;
  return { query: match[1], start: cursor - match[1].length - 1 };
}
