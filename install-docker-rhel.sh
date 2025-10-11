#!/bin/bash
# Install and start Docker on RHEL/CentOS/Rocky Linux
# Run as root or with sudo

set -e

echo "========================================="
echo "🐳 Docker Installation for RHEL/CentOS"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Remove old Docker versions if they exist
echo "🧹 Removing old Docker versions (if any)..."
yum remove -y docker \
    docker-client \
    docker-client-latest \
    docker-common \
    docker-latest \
    docker-latest-logrotate \
    docker-logrotate \
    docker-engine \
    podman \
    runc || true

# Install required packages
echo ""
echo "📦 Installing required packages..."
yum install -y yum-utils device-mapper-persistent-data lvm2

# Add Docker repository
echo ""
echo "📋 Adding Docker repository..."
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker Engine
echo ""
echo "🐳 Installing Docker Engine..."
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker daemon
echo ""
echo "🚀 Starting Docker daemon..."
systemctl start docker

# Enable Docker to start on boot
echo ""
echo "✅ Enabling Docker to start on boot..."
systemctl enable docker

# Verify installation
echo ""
echo "🔍 Verifying Docker installation..."
docker --version
docker compose version

# Test Docker
echo ""
echo "🧪 Testing Docker with hello-world..."
docker run --rm hello-world

# Check Docker daemon status
echo ""
echo "📊 Docker daemon status:"
systemctl status docker --no-pager

echo ""
echo "========================================="
echo "✅ Docker Installation Complete!"
echo "========================================="
echo ""
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
echo ""
echo "🎉 You can now run Docker containers!"
echo ""
echo "Optional: Add your user to docker group (logout required):"
echo "  sudo usermod -aG docker \$USER"
echo ""
echo "========================================="
