'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Save } from 'lucide-react';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user);
      setProfileForm({
        displayName: data.user?.displayName || '',
        email: data.user?.email || ''
      });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        setProfileError(data.error || 'Failed to update profile');
        return;
      }
      
      await loadUser();
      setProfileSuccess('Profile updated successfully');
    } catch (err: any) {
      setProfileError('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch('/api/auth/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
        return;
      }
      
      setPasswordSuccess('Password changed successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      setPasswordError('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="page-content">
        {/* Profile Settings */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">
              <User size={18} style={{ marginRight: '0.5rem' }} />
              Profile
            </h3>
          </div>
          <div className="card-body">
            {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}
            {profileError && <div className="alert alert-error">{profileError}</div>}
            
            <form onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.username || ''}
                    disabled
                  />
                  <div className="form-help">Username cannot be changed</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                    placeholder="Your display name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? <span className="spinner" /> : <Save size={16} />}
                Save Changes
              </button>
            </form>
          </div>
        </div>

        {/* Password Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Lock size={18} style={{ marginRight: '0.5rem' }} />
              Change Password
            </h3>
          </div>
          <div className="card-body">
            {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
            {passwordError && <div className="alert alert-error">{passwordError}</div>}
            
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="grid grid-cols-2">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    required
                  />
                  <div className="form-help">At least 8 characters</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                {savingPassword ? <span className="spinner" /> : <Lock size={16} />}
                Change Password
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
