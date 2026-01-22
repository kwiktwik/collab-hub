import { db } from './db';
import { notifications } from './db/schema';
import { v4 as uuidv4 } from 'uuid';

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'invite' | 'group' | 'project' | 'board' | 'task';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, link, metadata } = params;
  
  await db.insert(notifications).values({
    id: uuidv4(),
    userId,
    type,
    title,
    message,
    link: link || null,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
}

export async function notifyOrgInvite(userId: string, orgName: string, inviteToken: string) {
  await createNotification({
    userId,
    type: 'invite',
    title: 'Organization Invite',
    message: `You've been invited to join "${orgName}".`,
    link: `/invite/${inviteToken}`
  });
}

export async function notifyAddedToGroup(userId: string, groupName: string, groupId: string, role: string) {
  await createNotification({
    userId,
    type: 'group',
    title: 'Added to Group',
    message: `You have been added to "${groupName}" as ${role}.`,
    link: `/groups/${groupId}`
  });
}

export async function notifyRemovedFromGroup(userId: string, groupName: string) {
  await createNotification({
    userId,
    type: 'group',
    title: 'Removed from Group',
    message: `You have been removed from "${groupName}".`,
  });
}

export async function notifyGroupRoleChanged(userId: string, groupName: string, groupId: string, newRole: string) {
  await createNotification({
    userId,
    type: 'group',
    title: 'Group Role Changed',
    message: `Your role in "${groupName}" has been changed to ${newRole}.`,
    link: `/groups/${groupId}`
  });
}

export async function notifyProjectShared(userId: string, projectName: string, projectId: string, permissionLevel: string) {
  await createNotification({
    userId,
    type: 'project',
    title: 'Project Access Granted',
    message: `You now have ${permissionLevel} access to "${projectName}".`,
    link: `/projects/${projectId}`
  });
}

export async function notifyProjectAccessRemoved(userId: string, projectName: string) {
  await createNotification({
    userId,
    type: 'project',
    title: 'Project Access Removed',
    message: `Your access to "${projectName}" has been removed.`,
  });
}


