#!/bin/bash
# Install Docker Compose standalone on RHEL/CentOS
# Run as root or with sudo

set -e

echo "========================================="
echo "🐳 Installing Docker Compose"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Download latest docker-compose binary
echo "📥 Downloading Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
echo "Latest version: $DOCKER_COMPOSE_VERSION"

curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
echo ""
echo "✅ Making docker-compose executable..."
chmod +x /usr/local/bin/docker-compose

# Create symlink for docker-compose command
echo ""
echo "🔗 Creating symlink..."
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose || true

# Verify installation
echo ""
echo "🔍 Verifying installation..."
docker-compose --version

echo ""
echo "========================================="
echo "✅ Docker Compose Installation Complete!"
echo "========================================="
echo ""
echo "Version: $(docker-compose --version)"
echo ""
echo "🎉 You can now use docker-compose!"
echo "========================================="
