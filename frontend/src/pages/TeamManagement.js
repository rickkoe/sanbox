import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Dropdown, Modal, Form, Alert } from 'react-bootstrap';
import { Users, UserPlus, Shield, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

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

  useEffect(() => {
    if (user) {
      loadCustomerMemberships();
    }
  }, [user]);

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
      <div className="p-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <Users size={28} className="me-2" />
          Team Management
        </h2>
      </div>

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
        <div className="col-md-3 mb-4">
          <Card>
            <Card.Header>
              <h6 className="mb-0">Your Customers</h6>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="list-group list-group-flush">
                {customerMemberships.map((membership) => (
                  <button
                    key={membership.id}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      selectedCustomer?.id === membership.customer.id ? 'active' : ''
                    }`}
                    onClick={() => selectCustomer(membership.customer)}
                  >
                    <span>{membership.customer.name}</span>
                    <Badge bg={getRoleBadgeVariant(membership.role)} className="d-flex align-items-center gap-1">
                      {getRoleIcon(membership.role)}
                      {membership.role}
                    </Badge>
                  </button>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-9">
          {selectedCustomer ? (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Team Members - {selectedCustomer.name}</h6>
                {canManageTeam() && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <UserPlus size={16} className="me-1" />
                    Invite User
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                <Table responsive hover>
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
                          <div className="d-flex align-items-center">
                            <Users size={16} className="me-2 text-muted" />
                            {membership.user.username}
                            {membership.user.id === user.id && (
                              <Badge bg="info" className="ms-2">You</Badge>
                            )}
                          </div>
                        </td>
                        <td>{membership.user.email}</td>
                        <td>
                          <Badge bg={getRoleBadgeVariant(membership.role)} className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                            {getRoleIcon(membership.role)}
                            {membership.role}
                          </Badge>
                        </td>
                        <td>{new Date(membership.created_at).toLocaleDateString()}</td>
                        {canManageTeam() && (
                          <td>
                            {membership.user.id !== user.id && (
                              <Dropdown>
                                <Dropdown.Toggle variant="outline-secondary" size="sm">
                                  Actions
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Header>Change Role</Dropdown.Header>
                                  <Dropdown.Item
                                    onClick={() => handleChangeRole(membership.id, 'admin')}
                                    disabled={membership.role === 'admin'}
                                  >
                                    <Shield size={14} className="me-2" />
                                    Admin
                                  </Dropdown.Item>
                                  <Dropdown.Item
                                    onClick={() => handleChangeRole(membership.id, 'member')}
                                    disabled={membership.role === 'member'}
                                  >
                                    <Edit2 size={14} className="me-2" />
                                    Member
                                  </Dropdown.Item>
                                  <Dropdown.Item
                                    onClick={() => handleChangeRole(membership.id, 'viewer')}
                                    disabled={membership.role === 'viewer'}
                                  >
                                    <Eye size={14} className="me-2" />
                                    Viewer
                                  </Dropdown.Item>
                                  <Dropdown.Divider />
                                  <Dropdown.Item
                                    onClick={() => handleRemoveMember(membership.id)}
                                    className="text-danger"
                                  >
                                    <Trash2 size={14} className="me-2" />
                                    Remove
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <Card.Body className="text-center text-muted py-5">
                <Users size={48} className="mb-3" />
                <p>Select a customer to view team members</p>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Invite Team Member</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleInviteUser}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="viewer">Viewer - Read-only access</option>
                <option value="member">Member - Can create/modify own projects</option>
                <option value="admin">Admin - Can modify infrastructure</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <UserPlus size={16} className="me-1" />
              Send Invitation
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamManagement;
