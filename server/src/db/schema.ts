import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Groups table
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Group members (junction table)
export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Projects table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'archived', 'completed'] }).notNull().default('active'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Project groups (junction table for project-group access)
export const projectGroups = sqliteTable('project_groups', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  permissionLevel: text('permission_level', { enum: ['read', 'write', 'admin'] }).notNull().default('read'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Documents table
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Credentials table (encrypted storage)
export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['api_key', 'password', 'token', 'certificate', 'other'] }).notNull().default('other'),
  encryptedValue: text('encrypted_value').notNull(),
  encryptionIv: text('encryption_iv').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Files table
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  originalName: text('original_name').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  folderId: text('folder_id'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Folders table (for file organization)
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Activity log table
export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Sessions table for express-session
export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sess: text('sess').notNull(),
  expired: integer('expired', { mode: 'timestamp' }).notNull()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  createdProjects: many(projects),
  documents: many(documents),
  credentials: many(credentials),
  files: many(files),
  activityLogs: many(activityLogs)
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, { fields: [groups.createdBy], references: [users.id] }),
  members: many(groupMembers),
  projectAccess: many(projectGroups)
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] })
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, { fields: [projects.createdBy], references: [users.id] }),
  groupAccess: many(projectGroups),
  documents: many(documents),
  credentials: many(credentials),
  files: many(files),
  folders: many(folders),
  activityLogs: many(activityLogs)
}));

export const projectGroupsRelations = relations(projectGroups, ({ one }) => ({
  project: one(projects, { fields: [projectGroups.projectId], references: [projects.id] }),
  group: one(groups, { fields: [projectGroups.groupId], references: [groups.id] })
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  creator: one(users, { fields: [documents.createdBy], references: [users.id] })
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  project: one(projects, { fields: [credentials.projectId], references: [projects.id] }),
  creator: one(users, { fields: [credentials.createdBy], references: [users.id] })
}));

export const filesRelations = relations(files, ({ one }) => ({
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
  creator: one(users, { fields: [files.createdBy], references: [users.id] })
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  project: one(projects, { fields: [folders.projectId], references: [projects.id] }),
  creator: one(users, { fields: [folders.createdBy], references: [users.id] }),
  files: many(files)
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectGroup = typeof projectGroups.$inferSelect;
export type NewProjectGroup = typeof projectGroups.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
