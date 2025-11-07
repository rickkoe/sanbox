"""
Centralized constants for the core app.
"""

# Centralized action choices for all project junction tables
# Used by: ProjectFabric, ProjectSwitch, ProjectAlias, ProjectZone,
#          ProjectStorage, ProjectHost, ProjectVolume, ProjectPort
PROJECT_ACTION_CHOICES = [
    ('new', 'Created in this project'),
    ('modified', 'Existed but modified in this project'),
    ('unmodified', 'Existed and has not been modified in this project'),
]
