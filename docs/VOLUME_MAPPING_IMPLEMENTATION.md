# Volume-to-Host Mapping System Implementation

This document summarizes the volume-to-host mapping feature implemented for DS8000 storage systems.

## Overview

The system allows mapping volumes to hosts with three target types:
1. **Single Host** - Direct 1:1 mapping of volumes to a host
2. **Host Cluster** - All hosts in the cluster share all volumes (identical mappings)
3. **IBM i LPAR** - Volumes are distributed evenly across hosts using contiguous ranges

## Database Models

### Backend Models (`backend/storage/models.py`)

#### HostCluster
Groups multiple hosts that SHARE the same volumes.
```python
class HostCluster(models.Model):
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='host_clusters')
    hosts = models.ManyToManyField(Host, related_name='clusters', blank=True)
    notes = models.TextField(null=True, blank=True)

    # Lifecycle tracking
    committed = models.BooleanField(default=False)
    deployed = models.BooleanField(default=False)
    created_by_project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True)

    # Audit fields
    last_modified_by, last_modified_at, version, created_at, updated_at

    class Meta:
        unique_together = ['storage', 'name']
```

#### IBMiLPAR
Groups hosts for EVEN DISTRIBUTION of volumes.
```python
class IBMiLPAR(models.Model):
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='ibmi_lpars')
    hosts = models.ManyToManyField(Host, related_name='ibmi_lpars', blank=True)
    notes = models.TextField(null=True, blank=True)

    # Same lifecycle and audit fields as HostCluster

    class Meta:
        unique_together = ['storage', 'name']
        verbose_name = "IBM i LPAR"
```

#### VolumeMapping
Tracks volume-to-target mappings with polymorphic targets.
```python
class VolumeMapping(models.Model):
    TARGET_TYPE_CHOICES = [
        ('host', 'Host'),
        ('cluster', 'Host Cluster'),
        ('lpar', 'IBM i LPAR'),
    ]

    volume = models.ForeignKey(Volume, on_delete=models.CASCADE, related_name='volume_mappings')
    target_type = models.CharField(max_length=10, choices=TARGET_TYPE_CHOICES)

    # Polymorphic targets (only one populated based on target_type)
    target_host = models.ForeignKey(Host, null=True, blank=True, related_name='direct_volume_mappings')
    target_cluster = models.ForeignKey(HostCluster, null=True, blank=True, related_name='volume_mappings')
    target_lpar = models.ForeignKey(IBMiLPAR, null=True, blank=True, related_name='volume_mappings')

    # For LPAR: tracks which specific host received this volume after distribution
    assigned_host = models.ForeignKey(Host, null=True, blank=True, related_name='assigned_volume_mappings')

    lun_id = models.IntegerField(null=True, blank=True)

    # Lifecycle and audit fields
```

### Project Junction Tables (`backend/core/models.py`)

Following the existing project lifecycle pattern:
- `ProjectHostCluster` - Links HostCluster to Project with action (new/modify/delete)
- `ProjectIBMiLPAR` - Links IBMiLPAR to Project
- `ProjectVolumeMapping` - Links VolumeMapping to Project

Each has: `project`, `entity`, `action`, `delete_me`, `field_overrides`, `notes`, `added_by`, timestamps

## API Endpoints (`backend/storage/urls.py`)

### Host Clusters
- `GET/POST /api/storage/host-clusters/` - List all / Create new
- `GET/PUT/DELETE /api/storage/host-clusters/<id>/` - Detail operations
- `GET/POST /api/storage/<storage_id>/host-clusters/` - Storage-scoped list/create

### IBM i LPARs
- `GET/POST /api/storage/ibmi-lpars/` - List all / Create new
- `GET/PUT/DELETE /api/storage/ibmi-lpars/<id>/` - Detail operations
- `GET/POST /api/storage/<storage_id>/ibmi-lpars/` - Storage-scoped list/create

### Volume Mappings
- `GET /api/storage/volume-mappings/` - List all
- `GET/DELETE /api/storage/volume-mappings/<id>/` - Detail operations
- `POST /api/storage/volume-mappings/create/` - Bulk create mappings
- `POST /api/storage/volume-mappings/preview/` - Preview distribution before creating
- `GET /api/storage/project/<project_id>/view/volume-mappings/` - Project view

### Key API Behaviors

**Project-aware filtering** (GET endpoints):
- Accepts `project_id` parameter
- Shows: committed entities OR entities in the specified project
- Used by frontend to show both committed hosts and uncommitted hosts in active project

**Creating with project lifecycle** (POST endpoints):
- Accepts `project_id` parameter
- Sets `committed=False`, `created_by_project=project`
- Creates junction table entry with `action='new'`

**Duplicate prevention** (volume_mapping_create):
- Checks if volumes already have mappings
- Skips already-mapped volumes
- Returns `skipped` count and error messages

## Distribution Algorithm (`backend/storage/volume_distribution.py`)

### Contiguous Range Distribution for DS8000

For IBM i LPARs on DS8000, volumes are distributed in **contiguous ranges**:

```
Example: 214 volumes (107 in LSS 50, 107 in LSS 51) to 2 hosts

LSS 50:
- Host 1 gets volumes 5000-5035 (54 volumes, contiguous)
- Host 2 gets volumes 5036-506A (53 volumes, contiguous)

LSS 51 (order alternates for balance):
- Host 2 gets volumes 5100-5134 (53 volumes, contiguous)
- Host 1 gets volumes 5135-516A (54 volumes, contiguous)

Result: Each host gets 107 total volumes, balanced across LSS groups
```

### Key Functions

- `distribute_volumes_to_lpar(volumes, hosts, storage_type)` - Main distribution function
- `_distribute_ds8000_volumes(volumes, hosts)` - Contiguous range algorithm
- `_distribute_round_robin(volumes, hosts)` - For non-DS8000 storage
- `preview_distribution(volumes, hosts, storage_type)` - Generate preview for UI
- `_calculate_volume_ranges(volumes)` - Group consecutive volumes into ranges for display

## Frontend Components

### MapVolumesToHostModal (`frontend/src/components/modals/MapVolumesToHostModal.jsx`)

Multi-step wizard for mapping volumes to hosts:

1. **Step 1 - Target Type**: Select Host / Cluster / LPAR
2. **Step 2 - Select Target**: Pick existing or create new target
3. **Step 3 - Preview**: Shows distribution with volume ranges
4. **Step 4 - Confirm**: Review and create mappings

**Features:**
- Creates new clusters/LPARs inline with project lifecycle
- Shows volume ranges in monospace format (e.g., "50: 00-35 | 51: 35-6A")
- Warns about already-mapped volumes that will be skipped
- Displays "Balanced" badge when distribution is even

### VolumeRangeTableTanStackClean Integration

Added to Volume Ranges table (`frontend/src/components/tables/VolumeRangeTableTanStackClean.jsx`):
- Select column for bulk selection in Project View
- Actions dropdown with "Map to Host..." option
- Expands selected ranges to individual volume IDs for mapping

### Hook: useProjectViewSelection

Extended to support `onMapToHost` callback for the Actions dropdown.

## Serializers (`backend/storage/serializers.py`)

- `HostClusterSerializer` - Includes host_count, volume_count, hosts_details, project_memberships
- `IBMiLPARSerializer` - Same pattern as HostCluster
- `VolumeMappingSerializer` - Includes target_name, target_details, assigned_host_name

## Admin Panel (`backend/storage/admin.py`, `backend/core/admin.py`)

### Storage Admin
- `HostClusterAdmin` - With filter_horizontal for hosts, fieldsets for organization
- `IBMiLPARAdmin` - Similar to HostCluster
- `VolumeMappingAdmin` - Shows target_name method, all target FKs

### Core Admin (Junction Tables)
- `ProjectHostClusterAdmin`
- `ProjectIBMiLPARAdmin`
- `ProjectVolumeMappingAdmin`

## Database Migrations

Created migrations for:
1. HostCluster model
2. IBMiLPAR model
3. VolumeMapping model
4. ProjectHostCluster junction table
5. ProjectIBMiLPAR junction table
6. ProjectVolumeMapping junction table

## What's Still Needed

### Tables for Managing Entities

Need TanStack tables for:
1. **HostCluster Table** - CRUD for host clusters
2. **IBMiLPAR Table** - CRUD for IBM i LPARs
3. **VolumeMapping Table** - View/manage volume mappings

These should follow the existing table patterns with:
- Project View support (select column, actions dropdown)
- Customer View (read-only)
- Inline editing where appropriate
- Column configuration in `tableColumnConfig.json`

### Suggested Table Locations

Option 1: Storage Detail sub-pages (alongside Volumes, Hosts, Ports)
Option 2: Dedicated section in Storage Detail sidebar
Option 3: Modal-based management (accessed from Volume/Host tables)

### Table Column Suggestions

**HostCluster Table:**
- name, storage_name, host_count, volume_count, committed, deployed, notes

**IBMiLPAR Table:**
- name, storage_name, host_count, volume_count, committed, deployed, notes

**VolumeMapping Table:**
- volume_name, volume_id, target_type, target_name, assigned_host (for LPAR), lun_id, committed, deployed

## File References

### Backend
- `backend/storage/models.py` - HostCluster, IBMiLPAR, VolumeMapping models
- `backend/storage/views.py` - API view functions
- `backend/storage/urls.py` - URL patterns
- `backend/storage/serializers.py` - DRF serializers
- `backend/storage/admin.py` - Django admin
- `backend/storage/volume_distribution.py` - Distribution algorithm
- `backend/core/models.py` - Project junction tables
- `backend/core/admin.py` - Junction table admin

### Frontend
- `frontend/src/components/modals/MapVolumesToHostModal.jsx` - Mapping wizard
- `frontend/src/components/tables/VolumeRangeTableTanStackClean.jsx` - Integration example
- `frontend/src/hooks/useProjectViewSelection.js` - Selection hook with onMapToHost
- `frontend/src/config/tableColumnConfig.json` - Add new table configs here
