#!/bin/bash
# Test script to create a test user and verify default widgets

echo "Creating test user..."
docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from core.models import DashboardLayout

# Create test user
username = 'testuser'
if not User.objects.filter(username=username).exists():
    user = User.objects.create_user(
        username=username,
        email='test@example.com',
        password='testpass123'
    )
    print(f"✓ Created test user: {username}")
    print(f"  Login with username: {username}, password: testpass123")
else:
    user = User.objects.get(username=username)
    print(f"✓ Test user already exists: {username}")

# Check if user has any dashboards
dashboard_count = DashboardLayout.objects.filter(user=user).count()
print(f"  User has {dashboard_count} dashboard(s)")

if dashboard_count > 0:
    print("\n  To test default widgets, delete existing dashboards:")
    print(f"  DashboardLayout.objects.filter(user__username='{username}').delete()")

EOF

echo ""
echo "Next steps:"
echo "1. Login at http://localhost:3000 with username: testuser, password: testpass123"
echo "2. Select a customer and project"
echo "3. Navigate to dashboard - you should see all 10 widgets!"
