import type { Activity } from "../types";

export function describeActivity(activity: Activity): string {
  const name = activity.user.name;
  switch (activity.type) {
    case "TASK_CREATED":
      return `${name} created this task`;
    case "TASK_COMPLETED":
      return `${name} marked this task complete`;
    case "TASK_REOPENED":
      return `${name} marked this task incomplete`;
    case "TASK_ASSIGNED":
      return `${name} updated the assignees`;
    case "TASK_UNASSIGNED":
      return `${name} removed the assignees`;
    case "DUE_DATE_CHANGED":
      return `${name} changed the due date`;
    case "PRIORITY_CHANGED":
      return `${name} changed the priority`;
    case "SECTION_CHANGED":
      return `${name} moved this task`;
    case "COMMENT_ADDED":
      return `${name} commented`;
    case "DESCRIPTION_CHANGED":
      return `${name} edited the description`;
    case "TITLE_CHANGED":
      return `${name} renamed this task`;
    case "SUBTASK_ADDED":
      return `${name} added a subtask${
        activity.metadata?.title ? `: "${activity.metadata.title}"` : ""
      }`;
    case "TAG_ADDED":
      return `${name} added a tag`;
    case "TAG_REMOVED":
      return `${name} removed a tag`;
    default:
      return `${name} updated this task`;
  }
}
