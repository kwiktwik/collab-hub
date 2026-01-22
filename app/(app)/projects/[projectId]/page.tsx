'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  FileText, 
  Key, 
  File, 
  Users, 
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  FolderPlus
} from 'lucide-react';
import Modal from '@/components/Modal';
import type { Project, Document, Credential, FileType, Folder, Group } from '@/lib/types';

type TabType = 'documents' | 'credentials' | 'files' | 'settings';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [loading, setLoading] = useState(true);
  
  // Documents state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', content: '' });
  
  // Credentials state
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showCredModal, setShowCredModal] = useState(false);
  const [credForm, setCredForm] = useState({ name: '', value: '', type: 'other', description: '' });
  const [revealedCreds, setRevealedCreds] = useState<Record<string, string>>({});
  
  // Files state
  const [files, setFiles] = useState<FileType[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Group sharing state
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'read' | 'write' | 'admin'>('read');
  const [sharing, setSharing] = useState(false);
  
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && project) {
      loadTabData();
    }
  }, [activeTab, projectId, project]);

  const loadProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        router.push('/projects');
        return;
      }
      const data = await res.json();
      setProject(data.project);
    } catch (error) {
      console.error('Error loading project:', error);
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    try {
      switch (activeTab) {
        case 'documents':
          const docsRes = await fetch(`/api/documents/project/${projectId}`);
          const docsData = await docsRes.json();
          setDocuments(docsData.flatList || docsData.documents || []);
          break;
        case 'credentials':
          const credsRes = await fetch(`/api/credentials/project/${projectId}`);
          const credsData = await credsRes.json();
          setCredentials(credsData.credentials || []);
          break;
        case 'files':
          const filesRes = await fetch(`/api/files/project/${projectId}`);
          const filesData = await filesRes.json();
          setFiles(filesData.files || []);
          setFolders(filesData.folders || []);
          break;
        case 'settings':
          const groupsRes = await fetch('/api/groups');
          const groupsData = await groupsRes.json();
          setAvailableGroups(groupsData.groups || []);
          break;
      }
    } catch (error) {
      console.error('Error loading tab data:', error);
    }
  };

  // Document handlers
  const handleSaveDocument = async () => {
    setSaving(true);
    setError('');
    try {
      const url = selectedDoc ? `/api/documents/${selectedDoc.id}` : '/api/documents';
      const method = selectedDoc ? 'PUT' : 'POST';
      const body = selectedDoc ? docForm : { ...docForm, projectId };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save document');
        return;
      }
      
      await loadTabData();
      setShowDocModal(false);
      setDocForm({ title: '', content: '' });
      setSelectedDoc(null);
    } catch (err: any) {
      setError('Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      await loadTabData();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // Credential handlers
  const handleSaveCredential = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credForm, projectId })
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save credential');
        return;
      }
      
      await loadTabData();
      setShowCredModal(false);
      setCredForm({ name: '', value: '', type: 'other', description: '' });
    } catch (err: any) {
      setError('Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const handleRevealCredential = async (credId: string) => {
    if (revealedCreds[credId]) {
      setRevealedCreds(prev => {
        const next = { ...prev };
        delete next[credId];
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/credentials/${credId}/value`);
      const data = await res.json();
      setRevealedCreds(prev => ({ ...prev, [credId]: data.credential.value }));
    } catch (error) {
      console.error('Error revealing credential:', error);
    }
  };

  const handleDeleteCredential = async (credId: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    try {
      await fetch(`/api/credentials/${credId}`, { method: 'DELETE' });
      await loadTabData();
    } catch (error) {
      console.error('Error deleting credential:', error);
    }
  };

  // File handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      
      await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      await loadTabData();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownloadFile = async (file: FileType) => {
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      await loadTabData();
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await fetch('/api/files/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: folderName })
      });
      await loadTabData();
      setShowFolderModal(false);
      setFolderName('');
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  // Group sharing handlers
  const handleShareWithGroup = async () => {
    if (!selectedGroupId) return;
    setSharing(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          permissionLevel: selectedPermission
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to share project');
        return;
      }
      
      await loadProject();
      setShowShareModal(false);
      setSelectedGroupId('');
      setSelectedPermission('read');
    } catch (err: any) {
      setError('Failed to share project');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to remove "${groupName}" from this project?`)) return;
    try {
      await fetch(`/api/projects/${projectId}/groups/${groupId}`, { method: 'DELETE' });
      await loadProject();
    } catch (err: any) {
      alert('Failed to remove group');
    }
  };

  const getUnsharedGroups = () => {
    if (!project?.groupAccess) return availableGroups;
    const sharedGroupIds = new Set(project.groupAccess.map(a => a.groupId));
    return availableGroups.filter(g => !sharedGroupIds.has(g.id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>Project not found</h3>
          <Link href="/projects" className="btn btn-primary">Back to Projects</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => router.push('/projects')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{project.name}</h1>
            {project.description && (
              <p className="text-muted text-sm mt-2">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={16} style={{ marginRight: '0.5rem' }} />
            Documents
          </button>
          <button 
            className={`tab ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            <Key size={16} style={{ marginRight: '0.5rem' }} />
            Credentials
          </button>
          <button 
            className={`tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <File size={16} style={{ marginRight: '0.5rem' }} />
            Files
          </button>
          <button 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} style={{ marginRight: '0.5rem' }} />
            Settings
          </button>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Documents</h3>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSelectedDoc(null);
                  setDocForm({ title: '', content: '' });
                  setShowDocModal(true);
                }}
              >
                <Plus size={16} />
                New Document
              </button>
            </div>
            <div className="card-body">
              {documents.length === 0 ? (
                <div className="empty-state">
                  <FileText className="empty-state-icon" />
                  <h3 className="empty-state-title">No documents yet</h3>
                  <p className="empty-state-description">
                    Create documents to organize your project knowledge.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Created By</th>
                        <th>Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map(doc => (
                        <tr key={doc.id}>
                          <td>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 0, height: 'auto' }}
                              onClick={() => {
                                setSelectedDoc(doc);
                                setDocForm({ title: doc.title, content: doc.content || '' });
                                setShowDocModal(true);
                              }}
                            >
                              {doc.title}
                            </button>
                          </td>
                          <td>{doc.creator?.displayName || doc.creator?.username}</td>
                          <td>{new Date(doc.updatedAt).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credentials Tab */}
        {activeTab === 'credentials' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Credentials</h3>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowCredModal(true)}
              >
                <Plus size={16} />
                Add Credential
              </button>
            </div>
            <div className="card-body">
              {credentials.length === 0 ? (
                <div className="empty-state">
                  <Key className="empty-state-icon" />
                  <h3 className="empty-state-title">No credentials stored</h3>
                  <p className="empty-state-description">
                    Securely store API keys, passwords, and other sensitive data.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Created By</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {credentials.map(cred => (
                        <tr key={cred.id}>
                          <td>{cred.name}</td>
                          <td>
                            <span className="badge badge-secondary">{cred.type}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <code style={{ 
                                background: 'var(--background-color)', 
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                fontFamily: 'monospace',
                                fontSize: '0.8125rem'
                              }}>
                                {revealedCreds[cred.id] || '••••••••••••'}
                              </code>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => handleRevealCredential(cred.id)}
                              >
                                {revealedCreds[cred.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </td>
                          <td>{cred.creator?.displayName || cred.creator?.username}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleDeleteCredential(cred.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Files</h3>
              <div className="flex gap-2">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowFolderModal(true)}
                >
                  <FolderPlus size={16} />
                  New Folder
                </button>
                <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={16} />
                  {uploading ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div className="card-body">
              {files.length === 0 && folders.length === 0 ? (
                <div className="empty-state">
                  <File className="empty-state-icon" />
                  <h3 className="empty-state-title">No files yet</h3>
                  <p className="empty-state-description">
                    Upload files to share with your team.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Type</th>
                        <th>Uploaded By</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map(file => (
                        <tr key={file.id}>
                          <td>{file.name}</td>
                          <td>{formatFileSize(file.size)}</td>
                          <td>{file.mimeType.split('/')[1]?.toUpperCase() || file.mimeType}</td>
                          <td>{file.creator?.displayName || file.creator?.username}</td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => handleDownloadFile(file)}
                              >
                                <Download size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Users size={18} style={{ marginRight: '0.5rem' }} />
                Group Access
              </h3>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowShareModal(true)}
                disabled={getUnsharedGroups().length === 0}
              >
                <Plus size={16} />
                Add Group
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted text-sm mb-4">
                Share this project with multiple groups. Each group can have different permission levels.
              </p>
              
              {project.groupAccess && project.groupAccess.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Permission Level</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.groupAccess.map(access => (
                        <tr key={access.id}>
                          <td>
                            <Link href={`/groups/${access.groupId}`}>
                              {access.group?.name}
                            </Link>
                          </td>
                          <td>
                            <span className={`badge badge-${
                              access.permissionLevel === 'admin' ? 'primary' :
                              access.permissionLevel === 'write' ? 'success' : 'secondary'
                            }`}>
                              {access.permissionLevel}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleRemoveGroup(access.groupId, access.group?.name || 'group')}
                              title="Remove group access"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <h3 className="empty-state-title">No groups have access</h3>
                  <p className="empty-state-description">
                    Share this project with groups to enable collaboration.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Modal */}
      <Modal
        isOpen={showDocModal}
        onClose={() => {
          setShowDocModal(false);
          setSelectedDoc(null);
          setDocForm({ title: '', content: '' });
          setError('');
        }}
        title={selectedDoc ? 'Edit Document' : 'New Document'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDocModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveDocument}
              disabled={saving || !docForm.title}
            >
              {saving ? <span className="spinner" /> : 'Save'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            type="text"
            className="form-input"
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
            placeholder="Document title"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Content</label>
          <textarea
            className="form-input form-textarea"
            value={docForm.content}
            onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
            placeholder="Write your document content..."
            rows={10}
          />
        </div>
      </Modal>

      {/* Credential Modal */}
      <Modal
        isOpen={showCredModal}
        onClose={() => {
          setShowCredModal(false);
          setCredForm({ name: '', value: '', type: 'other', description: '' });
          setError('');
        }}
        title="Add Credential"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCredModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveCredential}
              disabled={saving || !credForm.name || !credForm.value}
            >
              {saving ? <span className="spinner" /> : 'Save'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-input"
            value={credForm.name}
            onChange={(e) => setCredForm({ ...credForm, name: e.target.value })}
            placeholder="e.g., Production API Key"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select
            className="form-input form-select"
            value={credForm.type}
            onChange={(e) => setCredForm({ ...credForm, type: e.target.value })}
          >
            <option value="api_key">API Key</option>
            <option value="password">Password</option>
            <option value="token">Token</option>
            <option value="certificate">Certificate</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Value</label>
          <textarea
            className="form-input form-textarea"
            value={credForm.value}
            onChange={(e) => setCredForm({ ...credForm, value: e.target.value })}
            placeholder="Enter the secret value"
            rows={3}
          />
          <div className="form-help">This value will be encrypted.</div>
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <input
            type="text"
            className="form-input"
            value={credForm.description}
            onChange={(e) => setCredForm({ ...credForm, description: e.target.value })}
            placeholder="Brief description"
          />
        </div>
      </Modal>

      {/* Folder Modal */}
      <Modal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setFolderName('');
        }}
        title="Create Folder"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCreateFolder}
              disabled={!folderName.trim()}
            >
              Create
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Folder Name</label>
          <input
            type="text"
            className="form-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
          />
        </div>
      </Modal>

      {/* Share with Group Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedGroupId('');
          setSelectedPermission('read');
          setError('');
        }}
        title="Share Project with Group"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowShareModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleShareWithGroup}
              disabled={sharing || !selectedGroupId}
            >
              {sharing ? <span className="spinner" /> : 'Share'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        
        <div className="form-group">
          <label className="form-label">Select Group</label>
          <select
            className="form-input form-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            <option value="">Choose a group...</option>
            {getUnsharedGroups().map(group => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.memberCount || group.members?.length || 0} members)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Permission Level</label>
          <select
            className="form-input form-select"
            value={selectedPermission}
            onChange={(e) => setSelectedPermission(e.target.value as 'read' | 'write' | 'admin')}
          >
            <option value="read">Read - View only access</option>
            <option value="write">Write - Can create and edit content</option>
            <option value="admin">Admin - Full access including settings</option>
          </select>
        </div>
      </Modal>
    </>
  );
}
