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

# Stub functions for backward compatibility
# All functions return permissive defaults (all authenticated users can do everything)


def has_customer_access(user, customer):
    """All authenticated users have access to all customers."""
    return user.is_authenticated


def has_project_access(user, project):
    """All authenticated users have access to all projects."""
    return user.is_authenticated


def can_edit_customer_infrastructure(user, customer):
    """All authenticated users can edit customer infrastructure."""
    return user.is_authenticated


def can_modify_project(user, project):
    """All authenticated users can modify projects."""
    return user.is_authenticated


def is_customer_admin(user, customer):
    """All authenticated users are considered admins."""
    return user.is_authenticated


def filter_by_customer_access(queryset, user):
    """Return all records for authenticated users."""
    if user.is_authenticated:
        return queryset
    return queryset.none()


def filter_by_project_access(queryset, user):
    """Return all records for authenticated users."""
    if user.is_authenticated:
        return queryset
    return queryset.none()
