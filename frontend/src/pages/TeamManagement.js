import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Eye, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './TeamManagement.css';

const TeamManagement = () => {
  const { user } = useAuth();
  const [customerMemberships, setCustomerMemberships] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    if (user) {
      loadCustomerMemberships();
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('.team-dropdown')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

  const loadCustomerMemberships = async () => {
    try {
      setLoading(true);
      // Get user's customer memberships
      const response = await api.get(`/core/users/${user.id}/customer-memberships/`);
      setCustomerMemberships(response.data);

      // Select first customer with admin role by default
      const adminMembership = response.data.find(m => m.role === 'admin');
      if (adminMembership) {
        selectCustomer(adminMembership.customer);
      } else if (response.data.length > 0) {
        selectCustomer(response.data[0].customer);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to load team data');
      setLoading(false);
    }
  };

  const selectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    try {
      // Load team members for this customer
      const response = await api.get(`/core/customers/${customer.id}/memberships/`);
      setTeamMembers(response.data);
    } catch (err) {
      setError('Failed to load team members');
    }
  };

  const getUserRole = (customerId) => {
    const membership = customerMemberships.find(m => m.customer.id === customerId);
    return membership?.role || null;
  };

  const canManageTeam = () => {
    if (!selectedCustomer) return false;
    return getUserRole(selectedCustomer.id) === 'admin';
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post(`/core/customers/${selectedCustomer.id}/invite/`, {
        email: inviteEmail,
        role: inviteRole
      });
      setSuccess('User invited successfully');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      selectCustomer(selectedCustomer); // Reload team members
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite user');
    }
  };

  const handleChangeRole = async (membershipId, newRole) => {
    setError('');
    setSuccess('');

    try {
      await api.patch(`/core/customer-memberships/${membershipId}/`, {
        role: newRole
      });
      setSuccess('Role updated successfully');
      selectCustomer(selectedCustomer); // Reload team members
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleRemoveMember = async (membershipId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.delete(`/core/customer-memberships/${membershipId}/`);
      setSuccess('Team member removed successfully');
      selectCustomer(selectedCustomer); // Reload team members
    } catch (err) {
      setError('Failed to remove team member');
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
      case 'member':
        return <Edit2 size={14} />;
      case 'viewer':
        return <Eye size={14} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="team-management-container">
        <div className="team-loading">
          <div className="team-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-management-container">
      <div className="team-management-header">
        <h2 className="team-management-title">
          <Users size={28} />
          Team Management
        </h2>
      </div>

      {error && (
        <div className="team-alert team-alert-danger">
          {error}
          <button className="team-alert-close" onClick={() => setError('')}>
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="team-alert team-alert-success">
          {success}
          <button className="team-alert-close" onClick={() => setSuccess('')}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="row">
        <div className="col-md-3 mb-4">
          <div className="team-card">
            <div className="team-card-header">
              <h6>Your Customers</h6>
            </div>
            <div className="team-card-body-no-padding">
              <div>
                {customerMemberships.map((membership) => (
                  <button
                    key={membership.id}
                    className={`customer-list-item ${
                      selectedCustomer?.id === membership.customer.id ? 'active' : ''
                    }`}
                    onClick={() => selectCustomer(membership.customer)}
                  >
                    <span>{membership.customer.name}</span>
                    <span className={`team-badge team-badge-${getRoleBadgeVariant(membership.role)}`}>
                      {getRoleIcon(membership.role)}
                      {membership.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-9">
          {selectedCustomer ? (
            <div className="team-card">
              <div className="team-card-header">
                <h6>Team Members - {selectedCustomer.name}</h6>
                {canManageTeam() && (
                  <button
                    className="team-button"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <UserPlus size={16} />
                    Invite User
                  </button>
                )}
              </div>
              <div className="team-card-body">
                <table className="team-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      {canManageTeam() && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((membership) => (
                      <tr key={membership.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={16} style={{ color: 'var(--secondary-text)' }} />
                            {membership.user.username}
                            {membership.user.id === user.id && (
                              <span className="team-badge team-badge-info" style={{ marginLeft: '0.5rem' }}>You</span>
                            )}
                          </div>
                        </td>
                        <td>{membership.user.email}</td>
                        <td>
                          <span className={`team-badge team-badge-${getRoleBadgeVariant(membership.role)}`}>
                            {getRoleIcon(membership.role)}
                            {membership.role}
                          </span>
                        </td>
                        <td>{new Date(membership.created_at).toLocaleDateString()}</td>
                        {canManageTeam() && (
                          <td>
                            {membership.user.id !== user.id && (
                              <div className="team-dropdown">
                                <button
                                  className="team-dropdown-toggle"
                                  onClick={() => setOpenDropdownId(openDropdownId === membership.id ? null : membership.id)}
                                >
                                  Actions
                                </button>
                                {openDropdownId === membership.id && (
                                  <div className="team-dropdown-menu">
                                    <div className="team-dropdown-header">Change Role</div>
                                    <button
                                      className="team-dropdown-item"
                                      onClick={() => {
                                        handleChangeRole(membership.id, 'admin');
                                        setOpenDropdownId(null);
                                      }}
                                      disabled={membership.role === 'admin'}
                                    >
                                      <Shield size={14} />
                                      Admin
                                    </button>
                                    <button
                                      className="team-dropdown-item"
                                      onClick={() => {
                                        handleChangeRole(membership.id, 'member');
                                        setOpenDropdownId(null);
                                      }}
                                      disabled={membership.role === 'member'}
                                    >
                                      <Edit2 size={14} />
                                      Member
                                    </button>
                                    <button
                                      className="team-dropdown-item"
                                      onClick={() => {
                                        handleChangeRole(membership.id, 'viewer');
                                        setOpenDropdownId(null);
                                      }}
                                      disabled={membership.role === 'viewer'}
                                    >
                                      <Eye size={14} />
                                      Viewer
                                    </button>
                                    <div className="team-dropdown-divider"></div>
                                    <button
                                      className="team-dropdown-item danger"
                                      onClick={() => {
                                        handleRemoveMember(membership.id);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="team-card">
              <div className="team-card-body team-empty-state">
                <Users size={48} style={{ marginBottom: '1rem' }} />
                <p>Select a customer to view team members</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="team-modal" onClick={() => setShowInviteModal(false)}>
          <div className="team-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="team-modal-header">
              <h5 className="team-modal-title">Invite Team Member</h5>
              <button className="team-modal-close" onClick={() => setShowInviteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInviteUser}>
              <div className="team-modal-body">
                <div className="team-form-group">
                  <label className="team-form-label">Email Address</label>
                  <input
                    type="email"
                    className="team-form-control"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="team-form-group">
                  <label className="team-form-label">Role</label>
                  <select
                    className="team-form-control"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="viewer">Viewer - Read-only access</option>
                    <option value="member">Member - Can create/modify own projects</option>
                    <option value="admin">Admin - Can modify infrastructure</option>
                  </select>
                </div>
              </div>
              <div className="team-modal-footer">
                <button type="button" className="team-button team-button-secondary" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="team-button">
                  <UserPlus size={16} />
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
