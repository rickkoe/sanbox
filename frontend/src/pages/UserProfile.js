import React, { useState } from 'react';
import { Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { User, Mail, Shield, Calendar, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

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
      <div className="p-4">
        <Alert variant="warning">Loading user data...</Alert>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4">
        <User size={28} className="me-2" />
        My Profile
      </h2>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess('')} dismissible>
          {success}
        </Alert>
      )}

      <div className="row">
        <div className="col-md-4 mb-4">
          <Card>
            <Card.Body className="text-center">
              <div className="mb-3">
                <div
                  className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center"
                  style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </div>
              <h4>{user.username}</h4>
              <p className="text-muted">{user.email}</p>

              {user.is_superuser && (
                <Badge bg="warning" className="mb-2">
                  <Shield size={14} className="me-1" />
                  Superuser
                </Badge>
              )}

              <div className="mt-3 pt-3 border-top">
                <small className="text-muted d-flex align-items-center justify-content-center">
                  <Calendar size={14} className="me-1" />
                  Joined {new Date(user.date_joined).toLocaleDateString()}
                </small>
              </div>
            </Card.Body>
          </Card>

          <Card className="mt-3">
            <Card.Header>
              <h6 className="mb-0">Customer Memberships</h6>
            </Card.Header>
            <Card.Body>
              {user.customer_memberships && user.customer_memberships.length > 0 ? (
                <div className="list-group list-group-flush">
                  {user.customer_memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="list-group-item d-flex justify-content-between align-items-center px-0"
                    >
                      <span>{membership.customer_name}</span>
                      <Badge bg={getRoleBadgeVariant(membership.role)} className="d-flex align-items-center gap-1">
                        {getRoleIcon(membership.role)}
                        {membership.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">No customer memberships yet</p>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-8">
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Profile Information</h6>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleUpdateProfile}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <User size={16} className="me-1" />
                    Username
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={user.username}
                    disabled
                    className="bg-light"
                  />
                  <Form.Text className="text-muted">
                    Username cannot be changed
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    <Mail size={16} className="me-1" />
                    Email Address
                  </Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>

                <Button variant="primary" type="submit" disabled={loading}>
                  <Save size={16} className="me-1" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h6 className="mb-0">Change Password</h6>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleChangePassword}>
                <Form.Group className="mb-3">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">
                    Must be at least 8 characters long
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Form.Group>

                <Button variant="primary" type="submit" disabled={loading}>
                  <Save size={16} className="me-1" />
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
