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
