import React, { useState } from 'react';
import { User, Mail, Shield, Calendar, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './UserProfile.css';

const UserProfile = () => {
  const { user, checkAuth } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.patch(`/core/users/${user.id}/`, {
        email
      });
      setSuccess('Profile updated successfully');
      checkAuth(); // Refresh user data
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await api.post(`/core/users/${user.id}/change-password/`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin':
        return 'danger';
      case 'member':
        return 'primary';
      case 'viewer':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} />;
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="user-profile-container">
        <div className="user-profile-alert user-profile-alert-warning">
          Loading user data...
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      <h2 className="user-profile-header">
        <User size={28} style={{ marginRight: '0.5rem' }} />
        My Profile
      </h2>

      {error && (
        <div className="user-profile-alert user-profile-alert-danger">
          {error}
          <button className="user-profile-alert-close" onClick={() => setError('')}>
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="user-profile-alert user-profile-alert-success">
          {success}
          <button className="user-profile-alert-close" onClick={() => setSuccess('')}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="user-profile-card">
            <div className="user-profile-card-body text-center">
              <div className="user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <h4 className="user-profile-username">{user.username}</h4>
              <p className="user-profile-email">{user.email}</p>

              {user.is_superuser && (
                <span className="user-profile-badge user-profile-badge-warning">
                  <Shield size={14} />
                  Superuser
                </span>
              )}

              <div className="user-profile-divider">
                <div className="user-profile-date">
                  <Calendar size={14} />
                  Joined {new Date(user.date_joined).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="user-profile-card">
            <div className="user-profile-card-header">
              <h6>Customer Memberships</h6>
            </div>
            <div className="user-profile-card-body">
              {user.customer_memberships && user.customer_memberships.length > 0 ? (
                <div>
                  {user.customer_memberships.map((membership) => (
                    <div key={membership.id} className="membership-list-item">
                      <span>{membership.customer_name}</span>
                      <span className={`user-profile-badge user-profile-badge-${getRoleBadgeVariant(membership.role)}`}>
                        {getRoleIcon(membership.role)}
                        {membership.role}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="membership-empty">No customer memberships yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="user-profile-card">
            <div className="user-profile-card-header">
              <h6>Profile Information</h6>
            </div>
            <div className="user-profile-card-body">
              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="user-profile-form-label">
                    <User size={16} />
                    Username
                  </label>
                  <input
                    type="text"
                    value={user.username}
                    disabled
                    className="user-profile-form-control"
                  />
                  <small className="user-profile-form-text">
                    Username cannot be changed
                  </small>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="user-profile-form-label">
                    <Mail size={16} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="user-profile-form-control"
                  />
                </div>

                <button type="submit" disabled={loading} className="user-profile-button">
                  <Save size={16} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          <div className="user-profile-card">
            <div className="user-profile-card-header">
              <h6>Change Password</h6>
            </div>
            <div className="user-profile-card-body">
              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="user-profile-form-label">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="user-profile-form-control"
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="user-profile-form-label">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="user-profile-form-control"
                  />
                  <small className="user-profile-form-text">
                    Must be at least 8 characters long
                  </small>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="user-profile-form-label">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="user-profile-form-control"
                  />
                </div>

                <button type="submit" disabled={loading} className="user-profile-button">
                  <Save size={16} />
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
