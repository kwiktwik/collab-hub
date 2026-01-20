import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 - let the app handle auth state
    // The AuthContext will set user to null and routes will handle redirects
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { username: string; email: string; password: string; displayName?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { displayName?: string; email?: string }) =>
    api.put('/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/me/password', data)
};

// Users API
export const usersApi = {
  search: (query: string) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  getById: (userId: string) => api.get(`/users/${userId}`)
};

// Groups API
export const groupsApi = {
  list: () => api.get('/groups'),
  get: (groupId: string) => api.get(`/groups/${groupId}`),
  create: (data: { name: string; description?: string }) => api.post('/groups', data),
  update: (groupId: string, data: { name?: string; description?: string }) =>
    api.put(`/groups/${groupId}`, data),
  delete: (groupId: string) => api.delete(`/groups/${groupId}`),
  addMember: (groupId: string, data: { userId?: string; username?: string; role?: string }) =>
    api.post(`/groups/${groupId}/members`, data),
  updateMember: (groupId: string, userId: string, data: { role: string }) =>
    api.put(`/groups/${groupId}/members/${userId}`, data),
  removeMember: (groupId: string, userId: string) =>
    api.delete(`/groups/${groupId}/members/${userId}`)
};

// Projects API
export const projectsApi = {
  list: () => api.get('/projects'),
  get: (projectId: string) => api.get(`/projects/${projectId}`),
  create: (data: { name: string; description?: string; groupId: string }) =>
    api.post('/projects', data),
  update: (projectId: string, data: { name?: string; description?: string; status?: string }) =>
    api.put(`/projects/${projectId}`, data),
  delete: (projectId: string) => api.delete(`/projects/${projectId}`),
  shareWithGroup: (projectId: string, data: { groupId: string; permissionLevel: string }) =>
    api.post(`/projects/${projectId}/groups`, data),
  updateGroupPermission: (projectId: string, groupId: string, data: { permissionLevel: string }) =>
    api.put(`/projects/${projectId}/groups/${groupId}`, data),
  removeGroup: (projectId: string, groupId: string) =>
    api.delete(`/projects/${projectId}/groups/${groupId}`)
};

// Documents API
export const documentsApi = {
  list: (projectId: string) => api.get(`/documents/project/${projectId}`),
  get: (documentId: string) => api.get(`/documents/${documentId}`),
  create: (data: { projectId: string; title: string; content?: string; parentId?: string }) =>
    api.post('/documents', data),
  update: (documentId: string, data: { title?: string; content?: string; parentId?: string; sortOrder?: number }) =>
    api.put(`/documents/${documentId}`, data),
  delete: (documentId: string) => api.delete(`/documents/${documentId}`),
  reorder: (projectId: string, orders: Array<{ id: string; sortOrder: number; parentId?: string }>) =>
    api.post('/documents/reorder', { projectId, orders })
};

// Credentials API
export const credentialsApi = {
  list: (projectId: string) => api.get(`/credentials/project/${projectId}`),
  getValue: (credentialId: string) => api.get(`/credentials/${credentialId}/value`),
  create: (data: { projectId: string; name: string; value: string; type?: string; description?: string }) =>
    api.post('/credentials', data),
  update: (credentialId: string, data: { name?: string; value?: string; type?: string; description?: string }) =>
    api.put(`/credentials/${credentialId}`, data),
  delete: (credentialId: string) => api.delete(`/credentials/${credentialId}`)
};

// Files API
export const filesApi = {
  list: (projectId: string, folderId?: string) =>
    api.get(`/files/project/${projectId}${folderId ? `?folderId=${folderId}` : ''}`),
  upload: (projectId: string, file: File, folderId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (folderId) formData.append('folderId', folderId);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  download: (fileId: string) => api.get(`/files/${fileId}/download`, { responseType: 'blob' }),
  getUrl: (fileId: string) => api.get(`/files/${fileId}/url`),
  update: (fileId: string, data: { name?: string; folderId?: string }) =>
    api.put(`/files/${fileId}`, data),
  delete: (fileId: string) => api.delete(`/files/${fileId}`),
  createFolder: (data: { projectId: string; name: string; parentId?: string }) =>
    api.post('/files/folders', data),
  updateFolder: (folderId: string, data: { name?: string; parentId?: string }) =>
    api.put(`/files/folders/${folderId}`, data),
  deleteFolder: (folderId: string) => api.delete(`/files/folders/${folderId}`)
};

export default api;
