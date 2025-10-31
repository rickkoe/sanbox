"""
Project Management API Views

Endpoints for managing project-entity relationships, project lifecycle,
and conflict detection.
"""

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q, Count
from .models import (
    Project, ProjectAlias, ProjectZone, ProjectFabric, ProjectSwitch,
    ProjectStorage, ProjectHost, ProjectVolume, ProjectPort, UserConfig
)
from san.models import Alias, Zone, Fabric, Switch
from storage.models import Storage, Host, Volume, Port
from san.serializers import ProjectAliasSerializer, ProjectZoneSerializer


@csrf_exempt
@require_http_methods(["POST"])
def project_add_alias(request, project_id):
    """Add an alias to a project with specified action"""
    try:
        data = json.loads(request.body)
        alias_id = data.get('alias_id')
        action = data.get('action', 'reference')
        include_in_zoning = data.get('include_in_zoning', False)
        notes = data.get('notes', '')

        if not alias_id:
            return JsonResponse({"error": "alias_id is required"}, status=400)

        try:
            project = Project.objects.get(id=project_id)
            alias = Alias.objects.get(id=alias_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)
        except Alias.DoesNotExist:
            return JsonResponse({"error": "Alias not found"}, status=404)

        # Create or update the junction entry
        project_alias, created = ProjectAlias.objects.update_or_create(
            project=project,
            alias=alias,
            defaults={
                'action': action,
                'include_in_zoning': include_in_zoning,
                'added_by': request.user if request.user.is_authenticated else None,
                'notes': notes
            }
        )

        serializer = ProjectAliasSerializer(project_alias)
        return JsonResponse({
            "success": True,
            "created": created,
            "project_alias": serializer.data
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def project_remove_alias(request, project_id, alias_id):
    """Remove an alias from a project"""
    try:
        deleted_count, _ = ProjectAlias.objects.filter(
            project_id=project_id,
            alias_id=alias_id
        ).delete()

        return JsonResponse({
            "success": True,
            "deleted": deleted_count > 0
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_add_zone(request, project_id):
    """Add a zone to a project with specified action"""
    try:
        data = json.loads(request.body)
        zone_id = data.get('zone_id')
        action = data.get('action', 'reference')
        notes = data.get('notes', '')

        if not zone_id:
            return JsonResponse({"error": "zone_id is required"}, status=400)

        try:
            project = Project.objects.get(id=project_id)
            zone = Zone.objects.get(id=zone_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)
        except Zone.DoesNotExist:
            return JsonResponse({"error": "Zone not found"}, status=404)

        # Create or update the junction entry
        project_zone, created = ProjectZone.objects.update_or_create(
            project=project,
            zone=zone,
            defaults={
                'action': action,
                'added_by': request.user if request.user.is_authenticated else None,
                'notes': notes
            }
        )

        serializer = ProjectZoneSerializer(project_zone)
        return JsonResponse({
            "success": True,
            "created": created,
            "project_zone": serializer.data
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def project_remove_zone(request, project_id, zone_id):
    """Remove a zone from a project"""
    try:
        deleted_count, _ = ProjectZone.objects.filter(
            project_id=project_id,
            zone_id=zone_id
        ).delete()

        return JsonResponse({
            "success": True,
            "deleted": deleted_count > 0
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_finalize(request, project_id):
    """
    Finalize a project - sets committed=True on all entities in the project
    """
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # Update project status
        project.status = 'finalized'
        project.save(update_fields=['status'])

        # Set committed=True on all entities in this project
        updated_counts = {}

        # Aliases
        alias_ids = ProjectAlias.objects.filter(project=project).values_list('alias_id', flat=True)
        updated_counts['aliases'] = Alias.objects.filter(
            id__in=alias_ids,
            committed=False
        ).update(committed=True)

        # Zones
        zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)
        updated_counts['zones'] = Zone.objects.filter(
            id__in=zone_ids,
            committed=False
        ).update(committed=True)

        # Fabrics
        fabric_ids = ProjectFabric.objects.filter(project=project).values_list('fabric_id', flat=True)
        updated_counts['fabrics'] = Fabric.objects.filter(
            id__in=fabric_ids,
            committed=False
        ).update(committed=True)

        # Switches
        switch_ids = ProjectSwitch.objects.filter(project=project).values_list('switch_id', flat=True)
        updated_counts['switches'] = Switch.objects.filter(
            id__in=switch_ids,
            committed=False
        ).update(committed=True)

        # Storage
        storage_ids = ProjectStorage.objects.filter(project=project).values_list('storage_id', flat=True)
        updated_counts['storage_systems'] = Storage.objects.filter(
            id__in=storage_ids,
            committed=False
        ).update(committed=True)

        # Hosts
        host_ids = ProjectHost.objects.filter(project=project).values_list('host_id', flat=True)
        updated_counts['hosts'] = Host.objects.filter(
            id__in=host_ids,
            committed=False
        ).update(committed=True)

        # Volumes
        volume_ids = ProjectVolume.objects.filter(project=project).values_list('volume_id', flat=True)
        updated_counts['volumes'] = Volume.objects.filter(
            id__in=volume_ids,
            committed=False
        ).update(committed=True)

        # Ports
        port_ids = ProjectPort.objects.filter(project=project).values_list('port_id', flat=True)
        updated_counts['ports'] = Port.objects.filter(
            id__in=port_ids,
            committed=False
        ).update(committed=True)

        return JsonResponse({
            "success": True,
            "project_status": "finalized",
            "updated_counts": updated_counts
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_close(request, project_id):
    """
    Close a project - removes all junction table entries and sets status to closed
    """
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # Update project status
        project.status = 'closed'
        project.save(update_fields=['status'])

        # Remove all junction table entries
        deleted_counts = {
            'aliases': ProjectAlias.objects.filter(project=project).delete()[0],
            'zones': ProjectZone.objects.filter(project=project).delete()[0],
            'fabrics': ProjectFabric.objects.filter(project=project).delete()[0],
            'switches': ProjectSwitch.objects.filter(project=project).delete()[0],
            'storage_systems': ProjectStorage.objects.filter(project=project).delete()[0],
            'hosts': ProjectHost.objects.filter(project=project).delete()[0],
            'volumes': ProjectVolume.objects.filter(project=project).delete()[0],
            'ports': ProjectPort.objects.filter(project=project).delete()[0],
        }

        return JsonResponse({
            "success": True,
            "project_status": "closed",
            "deleted_counts": deleted_counts
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_commit(request, project_id):
    """
    Commit project changes:
    1. Check for field-level conflicts (block if any)
    2. Apply field_overrides to base objects for action='modify'
    3. Mark action='create' entities as committed=True
    4. Return entities marked for deletion (requires user confirmation)

    Does NOT delete junction tables - use project_commit_and_close for that.
    """
    from core.utils.field_merge import apply_overrides_to_instance

    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # 1. Check for field-level conflicts first
        field_conflicts = _detect_field_conflicts(project)
        if field_conflicts:
            return JsonResponse({
                "error": "Cannot commit: field-level conflicts detected",
                "conflicts": field_conflicts
            }, status=409)

        applied_counts = {'aliases': 0, 'zones': 0, 'fabrics': 0, 'switches': 0,
                         'storage_systems': 0, 'hosts': 0, 'volumes': 0, 'ports': 0}

        # 2. Apply field_overrides for action='modify' entities

        # Aliases
        for pa in ProjectAlias.objects.filter(project=project, action='modify').select_related('alias'):
            if pa.field_overrides:
                alias = pa.alias
                apply_overrides_to_instance(alias, pa.field_overrides)
                alias.committed = True
                alias.save()
                applied_counts['aliases'] += 1
                print(f"✅ Applied overrides to alias: {alias.name}")

        # Zones
        for pz in ProjectZone.objects.filter(project=project, action='modify').select_related('zone'):
            if pz.field_overrides:
                zone = pz.zone
                # Handle member_ids separately if present
                member_ids = pz.field_overrides.pop('member_ids', None)

                apply_overrides_to_instance(zone, pz.field_overrides)
                zone.committed = True
                zone.save()

                if member_ids is not None:
                    zone.members.set(member_ids)

                applied_counts['zones'] += 1
                print(f"✅ Applied overrides to zone: {zone.name}")

        # Fabrics
        for pf in ProjectFabric.objects.filter(project=project, action='modify').select_related('fabric'):
            if pf.field_overrides:
                fabric = pf.fabric
                apply_overrides_to_instance(fabric, pf.field_overrides)
                fabric.committed = True
                fabric.save()
                applied_counts['fabrics'] += 1

        # Switches
        for ps in ProjectSwitch.objects.filter(project=project, action='modify').select_related('switch'):
            if ps.field_overrides:
                switch = ps.switch
                apply_overrides_to_instance(switch, ps.field_overrides)
                switch.committed = True
                switch.save()
                applied_counts['switches'] += 1

        # Storage
        for pst in ProjectStorage.objects.filter(project=project, action='modify').select_related('storage'):
            if pst.field_overrides:
                storage = pst.storage
                apply_overrides_to_instance(storage, pst.field_overrides)
                storage.committed = True
                storage.save()
                applied_counts['storage_systems'] += 1

        # Hosts
        for ph in ProjectHost.objects.filter(project=project, action='modify').select_related('host'):
            if ph.field_overrides:
                host = ph.host
                apply_overrides_to_instance(host, ph.field_overrides)
                host.committed = True
                host.save()
                applied_counts['hosts'] += 1

        # Volumes
        for pv in ProjectVolume.objects.filter(project=project, action='modify').select_related('volume'):
            if pv.field_overrides:
                volume = pv.volume
                apply_overrides_to_instance(volume, pv.field_overrides)
                volume.committed = True
                volume.save()
                applied_counts['volumes'] += 1

        # Ports
        for pp in ProjectPort.objects.filter(project=project, action='modify').select_related('port'):
            if pp.field_overrides:
                port = pp.port
                apply_overrides_to_instance(port, pp.field_overrides)
                port.committed = True
                port.save()
                applied_counts['ports'] += 1

        # 3. Mark action='create' entities as committed
        commit_counts = {'aliases': 0, 'zones': 0, 'fabrics': 0, 'switches': 0,
                        'storage_systems': 0, 'hosts': 0, 'volumes': 0, 'ports': 0}

        alias_ids = ProjectAlias.objects.filter(project=project, action='create').values_list('alias_id', flat=True)
        commit_counts['aliases'] = Alias.objects.filter(id__in=alias_ids, committed=False).update(committed=True)

        zone_ids = ProjectZone.objects.filter(project=project, action='create').values_list('zone_id', flat=True)
        commit_counts['zones'] = Zone.objects.filter(id__in=zone_ids, committed=False).update(committed=True)

        fabric_ids = ProjectFabric.objects.filter(project=project, action='create').values_list('fabric_id', flat=True)
        commit_counts['fabrics'] = Fabric.objects.filter(id__in=fabric_ids, committed=False).update(committed=True)

        switch_ids = ProjectSwitch.objects.filter(project=project, action='create').values_list('switch_id', flat=True)
        commit_counts['switches'] = Switch.objects.filter(id__in=switch_ids, committed=False).update(committed=True)

        storage_ids = ProjectStorage.objects.filter(project=project, action='create').values_list('storage_id', flat=True)
        commit_counts['storage_systems'] = Storage.objects.filter(id__in=storage_ids, committed=False).update(committed=True)

        host_ids = ProjectHost.objects.filter(project=project, action='create').values_list('host_id', flat=True)
        commit_counts['hosts'] = Host.objects.filter(id__in=host_ids, committed=False).update(committed=True)

        volume_ids = ProjectVolume.objects.filter(project=project, action='create').values_list('volume_id', flat=True)
        commit_counts['volumes'] = Volume.objects.filter(id__in=volume_ids, committed=False).update(committed=True)

        port_ids = ProjectPort.objects.filter(project=project, action='create').values_list('port_id', flat=True)
        commit_counts['ports'] = Port.objects.filter(id__in=port_ids, committed=False).update(committed=True)

        # 4. Collect entities marked for deletion (for confirmation)
        deletion_list = {
            'aliases': list(ProjectAlias.objects.filter(
                project=project, action='delete'
            ).select_related('alias').values('alias__id', 'alias__name')),
            'zones': list(ProjectZone.objects.filter(
                project=project, action='delete'
            ).select_related('zone').values('zone__id', 'zone__name')),
            'fabrics': list(ProjectFabric.objects.filter(
                project=project, action='delete'
            ).select_related('fabric').values('fabric__id', 'fabric__name')),
            'switches': list(ProjectSwitch.objects.filter(
                project=project, action='delete'
            ).select_related('switch').values('switch__id', 'switch__name')),
            'storage_systems': list(ProjectStorage.objects.filter(
                project=project, action='delete'
            ).select_related('storage').values('storage__id', 'storage__name')),
            'hosts': list(ProjectHost.objects.filter(
                project=project, action='delete'
            ).select_related('host').values('host__id', 'host__name')),
            'volumes': list(ProjectVolume.objects.filter(
                project=project, action='delete'
            ).select_related('volume').values('volume__id', 'volume__name')),
            'ports': list(ProjectPort.objects.filter(
                project=project, action='delete'
            ).select_related('port').values('port__id', 'port__id')),
        }

        # Count total entities to delete
        total_to_delete = sum(len(items) for items in deletion_list.values())

        return JsonResponse({
            "success": True,
            "applied_overrides": applied_counts,
            "committed_entities": commit_counts,
            "deletion_confirmation_needed": total_to_delete > 0,
            "entities_to_delete": deletion_list,
            "message": f"Changes committed. {total_to_delete} entities need deletion confirmation." if total_to_delete > 0 else "All changes committed successfully."
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_commit_deletions(request, project_id):
    """
    Execute confirmed deletions for entities marked with action='delete'

    This should only be called after project_commit returns entities requiring confirmation.
    """
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        deletion_counts = {'aliases': 0, 'zones': 0, 'fabrics': 0, 'switches': 0,
                          'storage_systems': 0, 'hosts': 0, 'volumes': 0, 'ports': 0}

        # Delete base objects where action='delete'
        # The CASCADE will automatically delete the ProjectAlias/ProjectZone entries

        for pa in ProjectAlias.objects.filter(project=project, action='delete').select_related('alias'):
            alias_name = pa.alias.name
            pa.alias.delete()
            deletion_counts['aliases'] += 1
            print(f"🗑️ Deleted alias: {alias_name}")

        for pz in ProjectZone.objects.filter(project=project, action='delete').select_related('zone'):
            zone_name = pz.zone.name
            pz.zone.delete()
            deletion_counts['zones'] += 1
            print(f"🗑️ Deleted zone: {zone_name}")

        for pf in ProjectFabric.objects.filter(project=project, action='delete').select_related('fabric'):
            pf.fabric.delete()
            deletion_counts['fabrics'] += 1

        for ps in ProjectSwitch.objects.filter(project=project, action='delete').select_related('switch'):
            ps.switch.delete()
            deletion_counts['switches'] += 1

        for pst in ProjectStorage.objects.filter(project=project, action='delete').select_related('storage'):
            pst.storage.delete()
            deletion_counts['storage_systems'] += 1

        for ph in ProjectHost.objects.filter(project=project, action='delete').select_related('host'):
            ph.host.delete()
            deletion_counts['hosts'] += 1

        for pv in ProjectVolume.objects.filter(project=project, action='delete').select_related('volume'):
            pv.volume.delete()
            deletion_counts['volumes'] += 1

        for pp in ProjectPort.objects.filter(project=project, action='delete').select_related('port'):
            pp.port.delete()
            deletion_counts['ports'] += 1

        return JsonResponse({
            "success": True,
            "deleted_counts": deletion_counts,
            "message": "Entities deleted successfully."
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def project_commit_and_close(request, project_id):
    """
    Commit all changes AND close the project (remove junction tables)

    Workflow:
    1. Execute commit (apply overrides, mark as committed)
    2. If deletions needed, require confirmation first
    3. Execute deletions if confirmed
    4. Delete all junction table entries
    5. Set project status to 'closed'
    """
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # Parse request body for deletion confirmation
        data = json.loads(request.body) if request.body else {}
        deletions_confirmed = data.get('deletions_confirmed', False)

        # Check if there are entities marked for deletion
        has_deletions = (
            ProjectAlias.objects.filter(project=project, action='delete').exists() or
            ProjectZone.objects.filter(project=project, action='delete').exists() or
            ProjectFabric.objects.filter(project=project, action='delete').exists() or
            ProjectSwitch.objects.filter(project=project, action='delete').exists() or
            ProjectStorage.objects.filter(project=project, action='delete').exists() or
            ProjectHost.objects.filter(project=project, action='delete').exists() or
            ProjectVolume.objects.filter(project=project, action='delete').exists() or
            ProjectPort.objects.filter(project=project, action='delete').exists()
        )

        if has_deletions and not deletions_confirmed:
            # Return error - deletions must be confirmed first
            deletion_list = {
                'aliases': list(ProjectAlias.objects.filter(
                    project=project, action='delete'
                ).select_related('alias').values('alias__id', 'alias__name')),
                'zones': list(ProjectZone.objects.filter(
                    project=project, action='delete'
                ).select_related('zone').values('zone__id', 'zone__name')),
            }
            return JsonResponse({
                "error": "Deletions must be confirmed before closing project",
                "entities_to_delete": deletion_list,
                "deletions_required": True
            }, status=400)

        # 1. Apply overrides and mark entities as committed
        from core.utils.field_merge import apply_overrides_to_instance

        # Apply overrides for all modify actions
        for pa in ProjectAlias.objects.filter(project=project, action='modify').select_related('alias'):
            if pa.field_overrides:
                apply_overrides_to_instance(pa.alias, pa.field_overrides)
                pa.alias.committed = True
                pa.alias.save()

        for pz in ProjectZone.objects.filter(project=project, action='modify').select_related('zone'):
            if pz.field_overrides:
                member_ids = pz.field_overrides.pop('member_ids', None)
                apply_overrides_to_instance(pz.zone, pz.field_overrides)
                pz.zone.committed = True
                pz.zone.save()
                if member_ids is not None:
                    pz.zone.members.set(member_ids)

        # Mark create entities as committed
        alias_ids = ProjectAlias.objects.filter(project=project, action='create').values_list('alias_id', flat=True)
        Alias.objects.filter(id__in=alias_ids).update(committed=True)

        zone_ids = ProjectZone.objects.filter(project=project, action='create').values_list('zone_id', flat=True)
        Zone.objects.filter(id__in=zone_ids).update(committed=True)

        # 2. Execute deletions if confirmed
        if deletions_confirmed:
            for pa in ProjectAlias.objects.filter(project=project, action='delete').select_related('alias'):
                pa.alias.delete()
            for pz in ProjectZone.objects.filter(project=project, action='delete').select_related('zone'):
                pz.zone.delete()

        # 3. Delete all junction table entries
        ProjectAlias.objects.filter(project=project).delete()
        ProjectZone.objects.filter(project=project).delete()
        ProjectFabric.objects.filter(project=project).delete()
        ProjectSwitch.objects.filter(project=project).delete()
        ProjectStorage.objects.filter(project=project).delete()
        ProjectHost.objects.filter(project=project).delete()
        ProjectVolume.objects.filter(project=project).delete()
        ProjectPort.objects.filter(project=project).delete()

        # 4. Close project
        project.status = 'closed'
        project.save(update_fields=['status'])

        return JsonResponse({
            "success": True,
            "project_status": "closed",
            "message": "Project committed and closed successfully."
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


def _detect_field_conflicts(project):
    """
    Helper function to detect field-level conflicts.
    Returns list of conflict dicts.
    """
    from core.utils.field_merge import detect_field_conflicts as util_detect_conflicts

    conflicts = []

    # Check aliases
    project_aliases = ProjectAlias.objects.filter(project=project).select_related('alias', 'project')
    other_aliases = ProjectAlias.objects.filter(
        alias_id__in=project_aliases.values_list('alias_id', flat=True)
    ).exclude(project=project).exclude(action='reference').select_related('alias', 'project')

    alias_conflicts = util_detect_conflicts(project_aliases, other_aliases)
    conflicts.extend(alias_conflicts)

    # Check zones
    project_zones = ProjectZone.objects.filter(project=project).select_related('zone', 'project')
    other_zones = ProjectZone.objects.filter(
        zone_id__in=project_zones.values_list('zone_id', flat=True)
    ).exclude(project=project).exclude(action='reference').select_related('zone', 'project')

    zone_conflicts = util_detect_conflicts(project_zones, other_zones)
    conflicts.extend(zone_conflicts)

    return conflicts


@csrf_exempt
@require_http_methods(["GET"])
def project_conflicts(request, project_id):
    """
    Detect conflicts where different projects want to perform different actions
    on the same entities
    """
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        conflicts = []

        # Check alias conflicts
        project_aliases = ProjectAlias.objects.filter(project=project).select_related('alias')
        for pa in project_aliases:
            # Find other projects with different actions on the same alias
            conflicting = ProjectAlias.objects.filter(
                alias=pa.alias
            ).exclude(
                project=project
            ).exclude(
                action=pa.action
            ).select_related('project', 'added_by')

            if conflicting.exists():
                conflicts.append({
                    'entity_type': 'alias',
                    'entity_id': pa.alias.id,
                    'entity_name': pa.alias.name,
                    'this_project_action': pa.action,
                    'conflicts': [
                        {
                            'project_id': c.project.id,
                            'project_name': c.project.name,
                            'action': c.action,
                            'added_by': c.added_by.username if c.added_by else None,
                            'added_at': c.added_at.isoformat()
                        }
                        for c in conflicting
                    ]
                })

        # Check zone conflicts
        project_zones = ProjectZone.objects.filter(project=project).select_related('zone')
        for pz in project_zones:
            # Find other projects with different actions on the same zone
            conflicting = ProjectZone.objects.filter(
                zone=pz.zone
            ).exclude(
                project=project
            ).exclude(
                action=pz.action
            ).select_related('project', 'added_by')

            if conflicting.exists():
                conflicts.append({
                    'entity_type': 'zone',
                    'entity_id': pz.zone.id,
                    'entity_name': pz.zone.name,
                    'this_project_action': pz.action,
                    'conflicts': [
                        {
                            'project_id': c.project.id,
                            'project_name': c.project.name,
                            'action': c.action,
                            'added_by': c.added_by.username if c.added_by else None,
                            'added_at': c.added_at.isoformat()
                        }
                        for c in conflicting
                    ]
                })

        return JsonResponse({
            "success": True,
            "project_id": project_id,
            "project_name": project.name,
            "conflict_count": len(conflicts),
            "conflicts": conflicts
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def project_summary(request, project_id):
    """Get summary statistics for a project"""
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # Count entities by action type
        summary = {
            'project_id': project_id,
            'project_name': project.name,
            'project_status': project.status,
            'aliases': {
                'total': ProjectAlias.objects.filter(project=project).count(),
                'create': ProjectAlias.objects.filter(project=project, action='create').count(),
                'delete': ProjectAlias.objects.filter(project=project, action='delete').count(),
                'modify': ProjectAlias.objects.filter(project=project, action='modify').count(),
                'reference': ProjectAlias.objects.filter(project=project, action='reference').count(),
            },
            'zones': {
                'total': ProjectZone.objects.filter(project=project).count(),
                'create': ProjectZone.objects.filter(project=project, action='create').count(),
                'delete': ProjectZone.objects.filter(project=project, action='delete').count(),
                'modify': ProjectZone.objects.filter(project=project, action='modify').count(),
                'reference': ProjectZone.objects.filter(project=project, action='reference').count(),
            },
            'fabrics': {
                'total': ProjectFabric.objects.filter(project=project).count(),
            },
            'switches': {
                'total': ProjectSwitch.objects.filter(project=project).count(),
            },
            'storage_systems': {
                'total': ProjectStorage.objects.filter(project=project).count(),
            },
            'hosts': {
                'total': ProjectHost.objects.filter(project=project).count(),
            },
            'volumes': {
                'total': ProjectVolume.objects.filter(project=project).count(),
            },
            'ports': {
                'total': ProjectPort.objects.filter(project=project).count(),
            }
        }

        return JsonResponse(summary)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
