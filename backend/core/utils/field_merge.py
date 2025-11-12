"""
Field Override Utilities

Helper functions for managing project-specific field overrides in junction tables.
Supports merge operations and conflict detection.
"""

from django.forms.models import model_to_dict
from django.db.models import ForeignKey


def serialize_foreign_keys(model_instance, data_dict):
    """
    Convert ForeignKey objects to their IDs in a dictionary.

    Django's model_to_dict returns FK objects, but we need IDs for JSON serialization.
    This function converts FK objects to their integer IDs.

    Args:
        model_instance: Django model instance (to inspect field types)
        data_dict: Dictionary potentially containing FK objects

    Returns:
        Dictionary with FK objects replaced by their IDs

    Example:
        >>> alias = Alias.objects.get(id=1)
        >>> data = {"name": "host01", "fabric": <Fabric object>}
        >>> serialized = serialize_foreign_keys(alias, data)
        >>> serialized
        {"name": "host01", "fabric": 5}  # FK object replaced with ID
    """
    if not data_dict or not model_instance:
        return data_dict

    serialized = data_dict.copy()

    # Get all FK fields from the model
    for field in model_instance._meta.get_fields():
        if isinstance(field, ForeignKey):
            field_name = field.name

            # If this FK field is in the data and is an object (not already an ID)
            if field_name in serialized:
                value = serialized[field_name]

                # Convert object to ID
                if value is not None and hasattr(value, 'pk'):
                    serialized[field_name] = value.pk
                # If it's already an int/ID or None, leave it as-is

    return serialized


def merge_with_overrides(base_instance, field_overrides):
    """
    Merge base model instance with project-specific field overrides.

    Args:
        base_instance: Django model instance (e.g., Alias, Zone)
        field_overrides: Dict of field overrides from ProjectAlias/ProjectZone/etc
                        Example: {"name": "modified_name", "use": "target"}

    Returns:
        Dict with base values + overrides applied

    Example:
        >>> alias = Alias.objects.get(id=1)  # name="host01", use="init"
        >>> overrides = {"name": "host01_modified"}
        >>> merged = merge_with_overrides(alias, overrides)
        >>> merged["name"]
        'host01_modified'
        >>> merged["use"]
        'init'
    """
    if base_instance is None:
        return field_overrides.copy() if field_overrides else {}

    # Get all fields from base instance
    base_data = model_to_dict(base_instance)

    # Serialize ForeignKey objects to IDs for JSON compatibility
    base_data = serialize_foreign_keys(base_instance, base_data)

    # Apply overrides on top of base data
    if field_overrides:
        base_data.update(field_overrides)

    return base_data


def apply_overrides_to_instance(base_instance, field_overrides):
    """
    Apply field overrides to a model instance (for commit operation).

    This modifies the instance in-place but does NOT save it.
    Caller is responsible for calling .save() on the returned instance.

    Args:
        base_instance: Django model instance to update
        field_overrides: Dict of field overrides to apply

    Returns:
        Updated instance (NOT saved to database)

    Example:
        >>> alias = Alias.objects.get(id=1)
        >>> overrides = {"name": "new_name", "use": "target"}
        >>> updated_alias = apply_overrides_to_instance(alias, overrides)
        >>> updated_alias.save()  # Caller must save
    """
    if not field_overrides:
        return base_instance

    # Build map of FK field names for efficient lookup
    fk_fields = {}
    for field in base_instance._meta.get_fields():
        if isinstance(field, ForeignKey):
            fk_fields[field.name] = field

    for field_name, value in field_overrides.items():
        # Check if field exists on the model
        if not hasattr(base_instance, field_name):
            print(f"Warning: Field '{field_name}' does not exist on {base_instance.__class__.__name__}")
            continue

        # Handle ForeignKey fields: if value is an ID, use field_name_id syntax
        if field_name in fk_fields and isinstance(value, int):
            # Set using the _id attribute (e.g., fabric_id instead of fabric)
            setattr(base_instance, f"{field_name}_id", value)
        else:
            # Regular field or FK object - set directly
            setattr(base_instance, field_name, value)

    return base_instance


def extract_changed_fields(base_instance, new_data, exclude_fields=None):
    """
    Extract only the fields that have changed between base instance and new data.

    Args:
        base_instance: Django model instance (current state)
        new_data: Dict of potentially new values
        exclude_fields: List of field names to ignore (e.g., ['id', 'created_at'])

    Returns:
        Dict containing only changed fields

    Example:
        >>> alias = Alias.objects.get(id=1)  # name="host01", use="init"
        >>> new_data = {"name": "host01", "use": "target", "notes": "Updated"}
        >>> changes = extract_changed_fields(alias, new_data)
        >>> changes
        {'use': 'target', 'notes': 'Updated'}  # Only changed fields
    """
    if exclude_fields is None:
        exclude_fields = ['id', 'created_at', 'updated_at', 'imported',
                         'last_modified_at', 'last_modified_by', 'version']

    # Build map of FK field names for efficient lookup
    fk_fields = {}
    for field in base_instance._meta.get_fields():
        if isinstance(field, ForeignKey):
            fk_fields[field.name] = field

    changed_fields = {}

    for field_name, new_value in new_data.items():
        # Skip excluded fields
        if field_name in exclude_fields:
            continue

        # Skip fields that don't exist on the model
        if not hasattr(base_instance, field_name):
            continue

        # Get current value from base instance
        current_value = getattr(base_instance, field_name, None)

        # For FK fields, compare by ID (not object instance)
        if field_name in fk_fields:
            # Get current FK ID
            current_id = current_value.pk if current_value and hasattr(current_value, 'pk') else None

            # Get new FK ID
            if isinstance(new_value, int):
                new_id = new_value
            elif new_value and hasattr(new_value, 'pk'):
                new_id = new_value.pk
            else:
                new_id = None

            # Compare IDs
            if current_id != new_id:
                # Store the ID (not the object) for JSON serialization
                changed_fields[field_name] = new_id
        else:
            # Regular field comparison
            # Handle None comparisons carefully
            # If both are None/empty, consider them equal
            if current_value is None and new_value in [None, '', []]:
                continue
            if new_value is None and current_value in [None, '', []]:
                continue

            # Check if value actually changed
            if current_value != new_value:
                changed_fields[field_name] = new_value

    return changed_fields


def detect_field_conflicts(project_alias_qs, other_project_aliases):
    """
    Detect field-level conflicts between project field_overrides.

    Args:
        project_alias_qs: QuerySet of ProjectAlias for the project being checked
        other_project_aliases: QuerySet of ProjectAlias from other projects on same entities

    Returns:
        List of conflict dicts with details about each conflict

    Example conflict dict:
        {
            'entity_type': 'alias',
            'entity_id': 123,
            'entity_name': 'host01',
            'field': 'use',
            'this_value': 'target',
            'other_project_id': 456,
            'other_project_name': 'Project B',
            'other_value': 'init'
        }
    """
    conflicts = []

    # Build a map of entity_id -> list of other project overrides
    other_overrides_map = {}
    for other_pa in other_project_aliases:
        entity_id = other_pa.alias_id if hasattr(other_pa, 'alias_id') else other_pa.zone_id
        if entity_id not in other_overrides_map:
            other_overrides_map[entity_id] = []
        other_overrides_map[entity_id].append(other_pa)

    # Check for conflicts
    for pa in project_alias_qs:
        entity_id = pa.alias_id if hasattr(pa, 'alias_id') else pa.zone_id
        entity_name = pa.alias.name if hasattr(pa, 'alias') else pa.zone.name
        entity_type = 'alias' if hasattr(pa, 'alias') else 'zone'

        # Get other projects working on same entity
        other_projects = other_overrides_map.get(entity_id, [])

        for other_pa in other_projects:
            # Compare field_overrides
            if not pa.field_overrides or not other_pa.field_overrides:
                continue

            for field_name, this_value in pa.field_overrides.items():
                if field_name in other_pa.field_overrides:
                    other_value = other_pa.field_overrides[field_name]

                    # Conflict if different values
                    if this_value != other_value:
                        conflicts.append({
                            'entity_type': entity_type,
                            'entity_id': entity_id,
                            'entity_name': entity_name,
                            'field': field_name,
                            'this_value': this_value,
                            'other_project_id': other_pa.project_id,
                            'other_project_name': other_pa.project.name,
                            'other_value': other_value
                        })

    return conflicts
