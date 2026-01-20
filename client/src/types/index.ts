export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  createdAt?: Date;
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
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
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
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface File {
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

export type PermissionLevel = 'read' | 'write' | 'admin';
export type GroupRole = 'admin' | 'member';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type CredentialType = 'api_key' | 'password' | 'token' | 'certificate' | 'other';
