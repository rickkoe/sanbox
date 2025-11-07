"""
Centralized constants for the core app.
"""

# Centralized action choices for all project junction tables
# Used by: ProjectFabric, ProjectSwitch, ProjectAlias, ProjectZone,
#          ProjectStorage, ProjectHost, ProjectVolume, ProjectPort
PROJECT_ACTION_CHOICES = [
    ('new', 'New - Generate creation commands'),
    ('delete', 'Delete - Generate deletion commands'),
    ('modify', 'Modify - Generate modification commands'),
    ('reference', 'Reference - Include in documentation only'),
]
