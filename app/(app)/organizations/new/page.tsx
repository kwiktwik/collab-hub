'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowLeft } from 'lucide-react';

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || name.trim().length < 2) {
      setError('Organization name must be at least 2 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create organization');
        return;
      }

      // Redirect to the new organization
      router.push(`/org/${data.organization.slug}`);
      router.refresh();
    } catch (err) {
      setError('Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Link href="/dashboard" className="btn btn-ghost" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={18} />
        Back to Dashboard
      </Link>

      <div className="card">
        <div className="card-body">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 64,
              height: 64,
              margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, var(--primary-color), #ec4899)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={32} color="white" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Create Organization
            </h1>
            <p className="text-muted">
              Organizations are workspaces where teams collaborate on projects, boards, and more.
            </p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Organization Name *</label>
              <input
                id="name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Acme Corporation"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your organization do?"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
