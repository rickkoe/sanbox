#!/bin/bash
# Rebuild all containers with the latest changes
# Use this when you have fixed network connectivity issues

set -e

echo "================================================"
echo "Rebuilding Sanbox Containers"
echo "================================================"
echo ""
echo "This will:"
echo "  1. Rebuild backend images with entrypoint script"
echo "  2. Auto-run migrations on startup"
echo "  3. Auto-create admin/admin superuser if needed"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "Stopping containers..."
docker-compose -f docker-compose.dev.yml down

echo ""
echo "Rebuilding images..."
docker-compose -f docker-compose.dev.yml build --no-cache

echo ""
echo "Starting containers..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "================================================"
echo "✅ Rebuild complete!"
echo "================================================"
echo ""
echo "Services:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  Admin:    http://localhost:8000/admin"
echo ""
echo "Default Superuser:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "Run './logs backend' to view startup logs"
echo ""
