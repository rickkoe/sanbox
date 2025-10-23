"""
Permission system removed - all users now have full access to all customers and projects.

The previous permission system included:
- CustomerMembership model with roles (admin/member/viewer)
- Project visibility (private/public/group)
- ProjectGroup for fine-grained access control

This has been simplified - all authenticated users can access all data.
Conflict prevention is now handled through optimistic locking (version fields)
and activity tracking (UserConfig.last_activity_at).

See git history for previous permission implementation if needed.
"""

# All permission functions removed - no longer needed
