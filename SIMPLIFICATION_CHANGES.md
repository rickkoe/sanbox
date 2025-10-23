# Sanbox Permission Simplification - Implementation Status

## Overview
Removing complex 3-tier permission system and replacing with optimistic locking for conflict prevention.

## ✅ COMPLETED CHANGES

### Models Updated ([core/models.py](backend/core/models.py))
- ✅ Removed `Project.owner`, `Project.visibility`, `Project.group` fields
- ✅ Deleted `ProjectGroup` model entirely
- ✅ Deleted `CustomerMembership` model entirely
- ✅ Added `last_activity_at` to `UserConfig` for presence tracking
- ✅ Added version/audit fields to `Alias` model ([san/models.py](backend/san/models.py:128-138))
- ✅ Added version/audit fields to `Zone` model ([san/models.py](backend/san/models.py:246-256))
- ✅ Added version/audit fields to `Host` model ([storage/models.py](backend/storage/models.py:196-206))
- ✅ Added version/audit fields to `Volume` model ([storage/models.py](backend/storage/models.py:415-425))
- ✅ Note: `Storage`, `Fabric`, `Switch`, `Port` already had version fields

### Admin Updated ([core/admin.py](backend/core/admin.py))
- ✅ Removed `CustomerMembership` and `ProjectGroup` from imports
- ✅ Removed `CustomerMembershipAdmin` and `ProjectGroupAdmin` classes

### Views Updated
- ✅ **[customers/views.py](backend/customers/views.py)** - Completely updated:
  - Removed CustomerMembership imports and permission checks
  - All authenticated users can now see/edit all customers
  - Removed role-based access control from ContactInfo viewset

- ✅ **[core/permissions.py](backend/core/permissions.py)** - Replaced with deprecation notice

##  REMAINING WORK

### 1. Serializers ([core/serializers.py](backend/core/serializers.py))
**Files to update:**
- Remove `CustomerMembershipSerializer` (lines 27-49)
- Remove `ProjectGroupSerializer` (lines 75-130)
- Update `UserSerializer` to remove `customer_memberships` field (lines 7-24)
- Update `ProjectSerializer` to remove `group_details` method (lines 56-72)
- Remove imports of deleted models

### 2. Views - [core/views.py](backend/core/views.py) (LARGE FILE - ~2500 lines)
**Functions that need to be removed entirely:**
- `customer_membership_management()` (lines ~2000-2100)
- `customer_membership_by_customer()` (lines ~2100-2150)
- `join_customer()` (lines ~2150-2200)
- `project_group_management()` (lines ~2200-2300)
- `project_group_detail()` (lines ~2300-2350)
- `project_group_members()` (lines ~2350-2400)
- `create_sample_customer_with_admin()` (lines ~2450-2550)

**Functions that need permission checks removed:**
- `project_management()` - Remove `can_view_project`, `can_create_project`, `can_modify_project` checks
- `table_configuration_view()` - Remove `can_view_customer` check
- Other view functions using permission imports

### 3. URL Routing ([core/urls.py](backend/core/urls.py))
**Routes to remove:**
- `/memberships/` - customer_membership_management
- `/memberships/<int:membership_id>/` - customer_membership_management
- `/memberships/customer/<int:customer_id>/` - customer_membership_by_customer
- `/memberships/join/` - join_customer
- `/project-groups/` - project_group_management
- `/project-groups/<int:group_id>/` - project_group_detail
- `/project-groups/<int:group_id>/members/` - project_group_members
- `/create-sample-customer/` - create_sample_customer_with_admin

### 4. Management Commands
**Files to remove or update:**
- `backend/core/management/commands/create_admin_memberships.py` - Delete entire file
- `backend/core/management/commands/setup_demo_data.py` - Remove CustomerMembership/ProjectGroup references

### 5. Worksheet Views ([core/worksheet_views.py](backend/core/worksheet_views.py))
- Remove CustomerMembership import if present
- Remove any permission checks

### 6. Database Migrations
**After all code changes:**
```bash
# Create migrations for all model changes
docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# Review migrations (especially the deletion of CustomerMembership and ProjectGroup)
# Apply migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

### 7. New APIs to Create (Phase 3 - Conflict Prevention)

#### A. Active Users API
Create endpoint: `/api/core/active-users/`
```python
@csrf_exempt
@require_http_methods(["GET"])
def active_users_view(request):
    """
    Get list of users currently editing customers/projects.
    Returns users active in last 5 minutes.
    """
    from datetime import timedelta
    from django.utils import timezone

    cutoff = timezone.now() - timedelta(minutes=5)
    active_configs = UserConfig.objects.filter(
        last_activity_at__gte=cutoff
    ).select_related('user', 'active_customer', 'active_project')

    result = []
    for config in active_configs:
        result.append({
            'user': {
                'id': config.user.id,
                'username': config.user.username
            },
            'active_customer': {
                'id': config.active_customer.id if config.active_customer else None,
                'name': config.active_customer.name if config.active_customer else None
            },
            'active_project': {
                'id': config.active_project.id if config.active_project else None,
                'name': config.active_project.name if config.active_project else None
            },
            'last_activity': config.last_activity_at.isoformat()
        })

    return JsonResponse({'active_users': result})
```

#### B. Heartbeat API
Create endpoint: `/api/core/heartbeat/`
```python
@csrf_exempt
@require_http_methods(["POST"])
def heartbeat_view(request):
    """
    Update user's last_activity_at timestamp.
    Called by frontend every 30 seconds.
    """
    user = request.user if request.user.is_authenticated else None
    if not user:
        return JsonResponse({"error": "Authentication required"}, status=401)

    user_config = UserConfig.get_or_create_for_user(user)
    user_config.last_activity_at = timezone.now()
    user_config.save(update_fields=['last_activity_at'])

    return JsonResponse({"success": True, "last_activity": user_config.last_activity_at.isoformat()})
```

#### C. Optimistic Locking in Save Operations
Add to all viewsets that handle versioned models (Zone, Alias, Storage, Host, Volume):

```python
def perform_update(self, serializer):
    """Update with optimistic locking check"""
    instance = serializer.instance
    client_version = self.request.data.get('version')

    if client_version is not None and instance.version != client_version:
        raise ValidationError({
            'version': f'Conflict: This object was modified by {instance.last_modified_by} at {instance.last_modified_at}. Please refresh and try again.',
            'current_version': instance.version,
            'current_data': serializer.to_representation(instance)
        })

    # Increment version and set modifier
    serializer.save(
        version=instance.version + 1,
        last_modified_by=self.request.user
    )
```

### 8. Frontend Changes (Not in scope of this backend work)
- Remove permission checks from frontend
- Add presence indicators showing active users
- Add heartbeat polling (every 30 seconds)
- Add conflict resolution UI
- Show warnings when data was recently modified by another user

## Testing Plan

1. **After Model Migrations:**
   - Verify all old CustomerMembership and ProjectGroup data is removed
   - Verify all models have version fields

2. **API Testing:**
   - Verify all users can see all customers
   - Verify all users can see all projects
   - Test optimistic locking: Two users editing same Zone
   - Test active users API
   - Test heartbeat API

3. **Edge Cases:**
   - What happens to existing Projects with owners/groups?
   - What happens to UserConfig pointing to deleted projects?

## Rollback Plan

If issues occur:
1. Restore from backup (use built-in backup UI at `/backups`)
2. Revert code changes via git
3. Run old migrations to restore permission tables

## Benefits After Completion

1. ✅ **Simpler permissions** - No more roles, groups, or visibility settings
2. ✅ **Better conflict prevention** - Version-based locking prevents data loss
3. ✅ **User awareness** - Know who's editing what in real-time
4. ✅ **Cleaner code** - Removed ~1000+ lines of permission logic
5. ✅ **Easier to understand** - New developers don't need to learn complex permission system
