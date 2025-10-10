# Docker Installation Guide

Complete guide for installing Docker on Mac, Windows, and Linux for Sanbox development.

## System Requirements

### Minimum Requirements
- **RAM**: 8GB (16GB recommended)
- **Disk Space**: 20GB free
- **CPU**: Multi-core processor with virtualization support

### Platform-Specific Requirements

**macOS**:
- macOS 11 Big Sur or newer
- Apple Silicon (M1/M2) or Intel processor

**Windows**:
- Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
- Windows 11 64-bit: Home, Pro, Enterprise, or Education
- WSL 2 feature enabled
- Virtualization enabled in BIOS

**Linux**:
- 64-bit kernel and CPU support for virtualization
- Ubuntu, Debian, CentOS, Fedora, or RHEL

---

## macOS Installation

### Method 1: Direct Download (Recommended)

This is the **most reliable method**, especially for beta or pre-release macOS versions.

#### 1. Download Docker Desktop

Visit: https://www.docker.com/products/docker-desktop

- **Apple Silicon (M1/M2/M3)**: Download "Mac with Apple chip"
- **Intel Mac**: Download "Mac with Intel chip"

#### 2. Install Docker Desktop

```bash
# Open the downloaded .dmg file
# Drag Docker.app to Applications folder
```

#### 3. Start Docker Desktop

```bash
# From Applications folder
open /Applications/Docker.app

# Or from terminal
open -a Docker
```

#### 4. Complete Setup

- Accept terms and conditions
- Provide admin password when prompted
- Wait for Docker to start (whale icon in menu bar)

#### 5. Verify Installation

```bash
# Check version
docker --version
# Expected: Docker version 24.0.0 or higher

# Check Docker Compose
docker-compose --version
# Expected: Docker Compose version v2.x.x or higher

# Test Docker
docker run hello-world
```

### Method 2: Homebrew (Alternative)

⚠️ **Note**: Homebrew may not support beta/pre-release macOS versions. If you encounter errors about unsupported macOS versions, use Method 1 (Direct Download) instead.

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop via Homebrew
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app
```

### Troubleshooting macOS

**Homebrew error: "unknown or unsupported macOS version"**:
```bash
# This occurs with beta/pre-release macOS versions
# Solution: Use Method 1 (Direct Download) instead
# Visit: https://www.docker.com/products/docker-desktop
# Download and install manually
```

**Docker won't start**:
```bash
# Check System Settings → Privacy & Security
# You may need to allow Docker in the Security section

# Check if virtualization is enabled
sysctl kern.hv_support
# Should return 1
```

**Permission denied**:
```bash
# Docker Desktop should handle permissions automatically
# If issues persist, ensure Docker Desktop is running
```

---

## Windows Installation

### Prerequisites

#### 1. Check Windows Version

```powershell
# Open PowerShell as Administrator
winver
```

Ensure you have:
- Windows 10 version 2004+ (Build 19041+), or
- Windows 11

#### 2. Enable WSL 2

```powershell
# Open PowerShell as Administrator

# Enable WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart computer
shutdown /r /t 0
```

#### 3. Install WSL 2

```powershell
# After restart, open PowerShell as Administrator

# Set WSL 2 as default
wsl --set-default-version 2

# Install Ubuntu (optional but recommended)
wsl --install -d Ubuntu
```

#### 4. Enable Virtualization in BIOS

If WSL installation fails:
1. Restart computer
2. Enter BIOS/UEFI (usually F2, F10, F12, or Del)
3. Find "Virtualization Technology" or "Intel VT-x/AMD-V"
4. Enable it
5. Save and exit

### Install Docker Desktop

#### 1. Download Docker Desktop

Visit: https://www.docker.com/products/docker-desktop

Download "Docker Desktop for Windows"

#### 2. Run Installer

```powershell
# Run the installer file
Docker Desktop Installer.exe

# During installation:
# ✅ Use WSL 2 instead of Hyper-V (recommended)
# ✅ Add shortcut to desktop
```

#### 3. Restart Computer

```powershell
# Restart when prompted
shutdown /r /t 0
```

#### 4. Start Docker Desktop

- Find Docker Desktop in Start menu
- Start the application
- Wait for Docker to initialize (system tray icon)
- Accept service agreement if prompted

#### 5. Verify Installation

```powershell
# Open PowerShell (regular user, not admin)

# Check version
docker --version

# Check Docker Compose
docker-compose --version

# Test Docker
docker run hello-world
```

### Troubleshooting Windows

**"WSL 2 installation is incomplete"**:
```powershell
# Download and install WSL 2 kernel update
# Visit: https://aka.ms/wsl2kernel

# After installing, restart Docker Desktop
```

**"Hardware assisted virtualization and data execution protection must be enabled in BIOS"**:
1. Restart computer
2. Enter BIOS (F2, F10, F12, or Del during boot)
3. Enable Virtualization Technology (Intel VT-x or AMD-V)
4. Enable VT-d if available
5. Save and exit

**Docker commands not recognized**:
```powershell
# Ensure Docker Desktop is running (check system tray)

# Add Docker to PATH (if needed)
# Docker Desktop should do this automatically
# If not, restart PowerShell
```

**WSL 2 distro errors**:
```powershell
# Check WSL version
wsl --list --verbose

# Update WSL distro to version 2
wsl --set-version Ubuntu 2

# Set as default
wsl --set-default Ubuntu
```

---

## Linux Installation

### Ubuntu / Debian

#### 1. Remove Old Versions

```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
```

#### 2. Install Docker Engine

```bash
# Update apt package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### 3. Post-Installation Steps

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Start Docker
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker
```

#### 4. Install Docker Compose (Standalone)

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink (optional)
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
```

#### 5. Verify Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose
docker-compose --version

# Test Docker (without sudo)
docker run hello-world
```

### CentOS / RHEL / Fedora

#### 1. Remove Old Versions

```bash
sudo dnf remove docker \
                docker-client \
                docker-client-latest \
                docker-common \
                docker-latest \
                docker-latest-logrotate \
                docker-logrotate \
                docker-engine
```

#### 2. Install Docker Engine

```bash
# Install dnf-plugins-core
sudo dnf -y install dnf-plugins-core

# Add Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo

# Install Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### 3. Post-Installation Steps

```bash
# Start Docker
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker
```

#### 4. Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose
```

#### 5. Verify Installation

```bash
docker --version
docker-compose --version
docker run hello-world
```

### Troubleshooting Linux

**Permission denied while trying to connect to Docker daemon**:
```bash
# Ensure docker daemon is running
sudo systemctl status docker

# Ensure you're in docker group
groups
# Should show 'docker' in the list

# If not, add yourself and reboot
sudo usermod -aG docker $USER
sudo reboot
```

**Docker service fails to start**:
```bash
# Check logs
sudo journalctl -u docker.service

# Check status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker
```

**Docker Compose not found**:
```bash
# Check if installed
which docker-compose

# If not found, install it
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

---

## Verification Steps

After installation on any platform:

### 1. Check Docker Version

```bash
docker --version
# Expected: Docker version 20.10.0 or higher
```

### 2. Check Docker Compose

```bash
docker-compose --version
# Expected: Docker Compose version v2.0.0 or higher
```

### 3. Test Docker

```bash
docker run hello-world
```

Expected output:
```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

### 4. Check Docker Info

```bash
docker info
```

Should show:
- Server Version
- Storage Driver
- Containers count
- Images count

### 5. Test Docker Compose

```bash
# Create test file
cat > docker-compose-test.yml <<EOF
version: '3.8'
services:
  test:
    image: hello-world
EOF

# Run it
docker-compose -f docker-compose-test.yml up

# Clean up
docker-compose -f docker-compose-test.yml down
rm docker-compose-test.yml
```

---

## Docker Desktop Configuration

### macOS / Windows

After installation, configure Docker Desktop:

#### 1. Resources

Open Docker Desktop → Settings → Resources

**Memory**: Allocate at least 4GB (8GB+ recommended for Sanbox)
**CPUs**: Allocate at least 2 CPUs (4+ recommended)
**Disk**: Ensure at least 20GB available

#### 2. File Sharing

**macOS**: Docker Desktop automatically shares necessary directories

**Windows**: Ensure your project directory is accessible
- Settings → Resources → File Sharing
- Add drive where Sanbox is located (usually C:)

#### 3. Docker Engine

Settings → Docker Engine

Default configuration is fine for Sanbox.

---

## Starting Docker

### macOS

```bash
# Start Docker Desktop
open /Applications/Docker.app

# Check if Docker is running
docker info
```

Docker Desktop icon should appear in menu bar (whale icon).

### Windows

```powershell
# Start Docker Desktop from Start menu
# Or run:
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Check if Docker is running
docker info
```

Docker Desktop icon should appear in system tray.

### Linux

```bash
# Start Docker service
sudo systemctl start docker

# Check status
sudo systemctl status docker

# Enable on boot
sudo systemctl enable docker

# Check if running
docker info
```

---

## Common Issues & Solutions

### "Cannot connect to Docker daemon"

**Mac/Windows**:
- Ensure Docker Desktop is running (check menu bar/system tray)
- Restart Docker Desktop

**Linux**:
```bash
sudo systemctl start docker
sudo systemctl status docker
```

### "Permission denied"

**Mac/Windows**:
- Docker Desktop handles permissions
- Restart Docker Desktop

**Linux**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login, or run:
newgrp docker
```

### "port already in use"

```bash
# Find what's using the port
lsof -i :3000  # or 8000, 5432, etc.

# Stop the conflicting service or change ports in docker-compose files
```

### Slow performance

**Mac/Windows**:
- Increase Docker Desktop resources
- Settings → Resources → Advanced
- Increase Memory and CPUs

**Linux**:
- Usually performs better than Mac/Windows
- Check system resources: `htop`

---

## Next Steps

After Docker is installed and running:

1. ✅ Verify Docker: `docker run hello-world`
2. ✅ Clone Sanbox repository
3. ✅ Start development: `./start`

See [CONTAINER_QUICKSTART.md](CONTAINER_QUICKSTART.md) for quick start guide.

---

## Additional Resources

- **Official Docker Documentation**: https://docs.docker.com/
- **Docker Desktop Manual**: https://docs.docker.com/desktop/
- **Docker Compose Documentation**: https://docs.docker.com/compose/
- **Get Docker**: https://docs.docker.com/get-docker/
- **Docker Hub**: https://hub.docker.com/

---

## Support

If you encounter issues:

1. Check Docker status: `docker info`
2. Check Docker Desktop logs (Settings → Troubleshoot → View logs)
3. Restart Docker Desktop
4. Consult official Docker documentation
5. Search Docker forums: https://forums.docker.com/
