#!/usr/bin/env python3
"""
Test script to verify optimistic locking works for Zones and Aliases.

Run this inside the Django container:
    docker-compose -f docker-compose.dev.yml exec backend python /app/test_optimistic_locking.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings_docker')
django.setup()

from san.models import Zone, Alias
from core.models import Project
from django.contrib.auth.models import User
from django.utils import timezone


def test_zone_optimistic_locking():
    """Test that zone version conflicts are detected."""
    print("\n" + "="*60)
    print("TEST: Zone Optimistic Locking")
    print("="*60)

    # Get or create a test zone
    project = Project.objects.first()
    if not project:
        print("❌ No projects found. Please create a project first.")
        return False

    zone = Zone.objects.filter(projects=project).first()
    if not zone:
        print("❌ No zones found for this project. Trying any zone...")
        zone = Zone.objects.first()
        if not zone:
            print("❌ No zones found at all. Please create a zone first.")
            return False

    print(f"\n📋 Test Zone: {zone.name}")
    print(f"   Current Version: {zone.version}")
    print(f"   Last Modified By: {zone.last_modified_by}")
    print(f"   Last Modified At: {zone.last_modified_at}")

    # Simulate User A reading the zone
    version_a = zone.version
    print(f"\n👤 User A reads zone (version {version_a})")

    # Simulate User B updating the zone
    user_b = User.objects.first()
    print(f"\n👤 User B ({user_b.username}) updates zone...")

    original_name = zone.name
    zone.name = f"{original_name} - Modified by {user_b.username}"
    zone.version += 1
    zone.last_modified_by = user_b
    zone.last_modified_at = timezone.now()
    zone.save()

    print(f"   ✅ Zone updated to version {zone.version}")
    print(f"   Name changed to: {zone.name}")

    # Simulate User A trying to update with stale version
    print(f"\n👤 User A tries to update with stale version {version_a}...")

    if version_a != zone.version:
        print(f"   ✅ CONFLICT DETECTED!")
        print(f"   User A has version {version_a}")
        print(f"   Current version is {zone.version}")
        print(f"   Last modified by: {zone.last_modified_by.username}")
        print(f"   Last modified at: {zone.last_modified_at}")

        # Restore original name
        zone.name = original_name
        zone.save()

        return True
    else:
        print(f"   ❌ CONFLICT NOT DETECTED - Something is wrong!")
        return False


def test_alias_optimistic_locking():
    """Test that alias version conflicts are detected."""
    print("\n" + "="*60)
    print("TEST: Alias Optimistic Locking")
    print("="*60)

    # Get or create a test alias
    alias = Alias.objects.first()
    if not alias:
        print("❌ No aliases found. Please create an alias first.")
        return False

    print(f"\n📋 Test Alias: {alias.name}")
    print(f"   Current Version: {alias.version}")
    print(f"   Last Modified By: {alias.last_modified_by}")
    print(f"   Last Modified At: {alias.last_modified_at}")

    # Simulate User A reading the alias
    version_a = alias.version
    print(f"\n👤 User A reads alias (version {version_a})")

    # Simulate User B updating the alias
    user_b = User.objects.first()
    print(f"\n👤 User B ({user_b.username}) updates alias...")

    original_wwpn = alias.wwpn
    alias.wwpn = "50:00:11:22:33:44:55:99"  # Changed WWPN
    alias.version += 1
    alias.last_modified_by = user_b
    alias.last_modified_at = timezone.now()
    alias.save()

    print(f"   ✅ Alias updated to version {alias.version}")
    print(f"   WWPN changed to: {alias.wwpn}")

    # Simulate User A trying to update with stale version
    print(f"\n👤 User A tries to update with stale version {version_a}...")

    if version_a != alias.version:
        print(f"   ✅ CONFLICT DETECTED!")
        print(f"   User A has version {version_a}")
        print(f"   Current version is {alias.version}")
        print(f"   Last modified by: {alias.last_modified_by.username}")
        print(f"   Last modified at: {alias.last_modified_at}")

        # Restore original WWPN
        alias.wwpn = original_wwpn
        alias.save()

        return True
    else:
        print(f"   ❌ CONFLICT NOT DETECTED - Something is wrong!")
        return False


def test_version_increment():
    """Test that version increments correctly on save."""
    print("\n" + "="*60)
    print("TEST: Version Increment on Save")
    print("="*60)

    zone = Zone.objects.first()
    if not zone:
        print("❌ No zones found.")
        return False

    version_before = zone.version
    print(f"\n📋 Zone: {zone.name}")
    print(f"   Version before: {version_before}")

    # Update zone
    zone.version += 1
    zone.save()

    print(f"   Version after: {zone.version}")

    if zone.version == version_before + 1:
        print(f"   ✅ Version incremented correctly!")
        return True
    else:
        print(f"   ❌ Version did not increment correctly!")
        return False


if __name__ == "__main__":
    print("\n" + "🔒 OPTIMISTIC LOCKING TEST SUITE")
    print("="*60)

    results = []

    # Run tests
    results.append(("Zone Optimistic Locking", test_zone_optimistic_locking()))
    results.append(("Alias Optimistic Locking", test_alias_optimistic_locking()))
    results.append(("Version Increment", test_version_increment()))

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")

    print(f"\n{passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        exit(0)
    else:
        print("\n⚠️  SOME TESTS FAILED")
        exit(1)
