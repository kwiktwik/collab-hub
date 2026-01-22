'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Building2, Save, Trash2, AlertTriangle } from 'lucide-react';
import Modal from '@/components/Modal';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  myRole: 'owner' | 'admin' | 'member';
}

export default function OrgSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadOrg();
  }, [slug]);

  const loadOrg = async () => {
    try {
      const orgsRes = await fetch('/api/organizations');
      const orgsData = await orgsRes.json();
      const organization = orgsData.organizations?.find((o: any) => o.slug === slug);
      
      if (!organization) {
        router.push('/dashboard');
        return;
      }

      if (organization.myRole === 'member') {
        router.push(`/org/${slug}/members`);
        return;
      }

      setOrg(organization);
      setName(organization.name);
      setDescription(organization.description || '');
    } catch (error) {
      console.error('Error loading organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/organizations/${org?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update organization');
        return;
      }

      setSuccess('Organization updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== org?.name) {
      setError('Please type the organization name to confirm');
      return;
    }

    setDeleting(true);

    try {
      const res = await fetch(`/api/organizations/${org?.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete organization');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('Failed to delete organization');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Organization Settings</h1>
          <p className="text-muted">{org.name}</p>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: '600px' }}>
        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        <div className="card">
          <div className="card-header">
            <h2>General</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : <><Save size={18} /> Save Changes</>}
            </button>
          </div>
        </div>

        {org.myRole === 'owner' && (
          <div className="card mt-4" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="card-header">
              <h2 style={{ color: '#ef4444' }}>Danger Zone</h2>
            </div>
            <div className="card-body">
              <p className="text-muted mb-4">
                Deleting an organization will permanently remove all its data including 
                groups, projects, boards, and files. This action cannot be undone.
              </p>
              <button 
                className="btn btn-danger"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={18} />
                Delete Organization
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
        title="Delete Organization"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== org?.name}
            >
              {deleting ? <span className="spinner" /> : 'Delete Forever'}
            </button>
          </>
        }
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <AlertTriangle size={48} color="#ef4444" />
        </div>
        <p style={{ marginBottom: '1rem' }}>
          This will permanently delete <strong>{org?.name}</strong> and all its data.
        </p>
        <div className="form-group">
          <label className="form-label">
            Type <strong>{org?.name}</strong> to confirm:
          </label>
          <input
            type="text"
            className="form-input"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={org?.name}
          />
        </div>
      </Modal>
    </>
  );
}
