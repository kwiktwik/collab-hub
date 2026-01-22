'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Building2, Check, X } from 'lucide-react';

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'member';
  organization: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  inviter: {
    displayName: string | null;
    username: string;
  };
}

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    try {
      const res = await fetch(`/api/invites/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid invite');
        return;
      }

      setInvite(data.invite);
    } catch (err) {
      setError('Failed to load invite');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');

    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invite');
        return;
      }

      router.push(`/org/${data.organization.slug}`);
      router.refresh();
    } catch (err) {
      setError('Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div style={{ maxWidth: '500px', margin: '4rem auto', padding: '0 1rem' }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{
              width: 64,
              height: 64,
              margin: '0 auto 1rem',
              background: 'rgba(239, 68, 68, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <X size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Invalid Invite
            </h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              {error}
            </p>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '4rem auto', padding: '0 1rem' }}>
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center' }}>
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

          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            You're invited to join
          </h2>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {invite?.organization.name}
          </h1>
          
          {invite?.organization.description && (
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              {invite.organization.description}
            </p>
          )}

          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
            {invite?.inviter.displayName || invite?.inviter.username} has invited you to join as a <strong>{invite?.role}</strong>.
          </p>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex gap-3" style={{ justifyContent: 'center' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => router.push('/dashboard')}
              disabled={accepting}
            >
              Decline
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? <span className="spinner" /> : (
                <>
                  <Check size={18} />
                  Accept Invite
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
