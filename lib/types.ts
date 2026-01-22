export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  members?: OrganizationMember[];
  myRole?: 'owner' | 'admin' | 'member';
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
  user?: Pick<User, 'id' | 'username' | 'displayName' | 'email' | 'avatarUrl'>;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  inviter?: Pick<User, 'id' | 'username' | 'displayName'>;
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
}

export interface GroupProjectAccess {
  id: string;
  projectId: string;
  groupId: string;
  permissionLevel: 'read' | 'write' | 'admin';
  createdAt: Date;
  project?: Pick<Project, 'id' | 'name' | 'description' | 'status'>;
}

export interface Group {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
  members?: GroupMember[];
  myRole?: 'admin' | 'member';
  memberCount?: number;
  projectAccess?: GroupProjectAccess[];
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
  createdAt: Date;
  user?: Pick<User, 'id' | 'username' | 'displayName' | 'email'>;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  groupAccess?: ProjectGroupAccess[];
  accessGroups?: Array<{
    group: Pick<Group, 'id' | 'name'>;
    permissionLevel: 'read' | 'write' | 'admin';
  }>;
}

export interface ProjectGroupAccess {
  id: string;
  projectId: string;
  groupId: string;
  permissionLevel: 'read' | 'write' | 'admin';
  createdAt: Date;
  group?: Group;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  parentId: string | null;
  sortOrder: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  children?: Document[];
}

export interface Credential {
  id: string;
  projectId: string;
  name: string;
  type: 'api_key' | 'password' | 'token' | 'certificate' | 'other';
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  value?: string; // Only populated when requesting the value
}

export interface Folder {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdBy: string;
  createdAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
}

export interface FileType {
  id: string;
  projectId: string;
  name: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdBy: string;
  createdAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  folder?: Pick<Folder, 'id' | 'name'>;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  metadata?: string | null;
  createdAt: Date;
}

// ========================================
// BOARD & TASK TYPES
// ========================================

export interface Board {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  key: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
  project?: Pick<Project, 'id' | 'name'>;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  columns?: BoardColumn[];
  sprints?: Sprint[];
  groupAccess?: BoardGroupAccess[];
  labels?: TaskLabel[];
}

export interface BoardGroupAccess {
  id: string;
  boardId: string;
  groupId: string;
  permissionLevel: 'read' | 'write' | 'admin';
  createdAt: Date;
  group?: Pick<Group, 'id' | 'name'>;
}

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  wipLimit: number | null;
  createdAt: Date;
  tasks?: Task[];
}

export interface Sprint {
  id: string;
  boardId: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: 'planning' | 'active' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: Pick<User, 'id' | 'username' | 'displayName'>;
  tasks?: Task[];
}

export interface TaskLabel {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  boardId: string;
  columnId: string;
  sprintId: string | null;
  taskNumber: number;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  storyPoints: number | null;
  assigneeId: string | null;
  reporterId: string;
  parentTaskId: string | null;
  dueDate: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  column?: Pick<BoardColumn, 'id' | 'name' | 'color'>;
  sprint?: Pick<Sprint, 'id' | 'name' | 'status'>;
  assignee?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  reporter?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  labels?: TaskLabel[];
  subtasks?: Task[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  board?: Pick<Board, 'id' | 'name' | 'key'>;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
  uploader?: Pick<User, 'id' | 'username' | 'displayName'>;
}

export type PermissionLevel = 'read' | 'write' | 'admin';
export type GroupRole = 'admin' | 'member';
export type OrganizationRole = 'owner' | 'admin' | 'member';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type CredentialType = 'api_key' | 'password' | 'token' | 'certificate' | 'other';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'invite' | 'group' | 'project' | 'board' | 'task';
export type SprintStatus = 'planning' | 'active' | 'completed';
export type TaskType = 'story' | 'task' | 'bug' | 'epic' | 'subtask';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';
