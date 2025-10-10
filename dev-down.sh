#!/bin/bash
set -e

# Stop development environment script for Sanbox

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================="
echo "🛑 Stopping Sanbox Development Environment"
echo "========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running."
    exit 1
fi

# Stop and remove containers
echo "🐳 Stopping Docker containers..."
docker-compose -f docker-compose.dev.yml down

echo ""
echo "========================================="
echo "✅ Development environment stopped!"
echo "========================================="
echo ""
echo "📊 Status:"
echo "  • All containers stopped"
echo "  • Networks removed"
echo "  • Volumes preserved (data retained)"
echo ""
echo "💡 Options:"
echo "  Start again:         ./dev-up.sh"
echo "  Remove volumes:      docker-compose -f docker-compose.dev.yml down -v"
echo "  View stopped:        docker-compose -f docker-compose.dev.yml ps -a"
echo ""
echo "📋 Data locations:"
echo "  • Database: Docker volume 'sanbox_dev_postgres_data_dev'"
echo "  • Redis: Docker volume 'sanbox_dev_redis_data_dev'"
echo "  • Logs: ./dev_logs/"
echo "========================================="
