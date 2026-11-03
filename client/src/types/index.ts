export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ActivityType =
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_REOPENED"
  | "TASK_ASSIGNED"
  | "TASK_UNASSIGNED"
  | "DUE_DATE_CHANGED"
  | "PRIORITY_CHANGED"
  | "SECTION_CHANGED"
  | "COMMENT_ADDED"
  | "DESCRIPTION_CHANGED"
  | "TITLE_CHANGED"
  | "SUBTASK_ADDED"
  | "TAG_ADDED"
  | "TAG_REMOVED";
export type NotificationType =
  | "TASK_ASSIGNED"
  | "COMMENT_ADDED"
  | "COMMENT_REPLY"
  | "DUE_SOON"
  | "MENTIONED"
  | "TASK_COMPLETED"
  | "ADDED_TO_PROJECT"
  | "ADDED_TO_WORKSPACE"
  | "WORKSPACE_INVITE"
  | "WORKSPACE_INVITE_ACCEPTED"
  | "PROJECT_INVITE"
  | "PROJECT_INVITE_ACCEPTED"
  | "TEAM_INVITE"
  | "TEAM_INVITE_ACCEPTED";
export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role?: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  teams?: Team[];
  projects?: Project[];
}

export interface WorkspaceMember {
  id: string;
  role: WorkspaceRole;
  createdAt: string;
  user: User;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  workspaceId: string;
  createdAt: string;
  members: { id: string; createdAt: string; user: User }[];
  projects?: Project[];
  invites?: { id: string; invitedUser: User }[];
  _count?: { projects: number };
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  workspaceId: string;
  teamId?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
  members?: { id: string; role?: "OWNER" | "EDITOR"; createdAt: string; user: User }[];
  invites?: { id: string; invitedUser: User }[];
  team?: Team | null;
  role?: WorkspaceRole;
  _count?: { tasks: number };
}

export interface Section {
  id: string;
  name: string;
  projectId: string;
  order: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
}

export interface TaskTag {
  taskId: string;
  tagId: string;
  tag: Tag;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  projectId: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  createdById: string;
  priority: Priority;
  completed: boolean;
  completedAt?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  assignees?: { user: User }[];
  createdBy?: User;
  tags?: TaskTag[];
  followers?: { id: string; user: User }[];
  subtasks?: Task[];
  comments?: Comment[];
  activities?: Activity[];
  project?: { id: string; name: string; color: string; workspaceId: string };
  _count?: { subtasks: number; comments: number };
}

export interface CommentMention {
  commentId: string;
  userId: string;
  user: User;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  parentCommentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  mentions?: CommentMention[];
}

export interface Activity {
  id: string;
  taskId: string;
  userId: string;
  type: ActivityType;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user: User;
}

export interface Notification {
  id: string;
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  message: string;
  taskId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
  inviteId?: string | null;
  projectInviteId?: string | null;
  teamInviteId?: string | null;
  read: boolean;
  createdAt: string;
  actor?: User | null;
}

// Invitee's view — from GET /api/invites/me.
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  invitedUserId: string;
  invitedById: string;
  status: InviteStatus;
  createdAt: string;
  respondedAt?: string | null;
  workspace: { id: string; name: string; slug: string };
  invitedBy: User;
}

// Admin's view — from GET /api/workspaces/:id/invites.
export interface PendingWorkspaceInvite {
  id: string;
  workspaceId: string;
  invitedUserId: string;
  invitedById: string;
  status: InviteStatus;
  createdAt: string;
  respondedAt?: string | null;
  invitedUser: User;
}
