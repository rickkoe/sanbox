# Sanbox System Requirements

This document outlines the system-level dependencies required for Sanbox to run in production.

## Required System Services

### 1. Redis (Message Broker for Celery)
```bash
# Install Redis
sudo dnf install redis -y

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis

# Test Redis
redis-cli ping  # Should return "PONG"
```

### 2. PostgreSQL (Production Database)
```bash
# Install PostgreSQL
sudo dnf install postgresql postgresql-server -y

# Initialize and start PostgreSQL
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Nginx (Web Server)
```bash
# Install Nginx
sudo dnf install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4. Node.js & npm (Frontend Build)
```bash
# Install Node.js
sudo dnf install nodejs npm -y
```

### 5. Python 3.11+ (Backend)
```bash
# Usually pre-installed on RHEL 9
python3 --version
```

## Service Status Check

```bash
# Check all required services
systemctl status redis
systemctl status postgresql
systemctl status nginx

# Quick health check
redis-cli ping
```

## Firewall Configuration

```bash
# Allow HTTP and HTTPS traffic
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Notes

- **Redis** is critical for background import tasks (Celery)
- **PostgreSQL** stores all application data in production
- **Nginx** serves the frontend and proxies API requests
- These services should start automatically on server reboot

## Troubleshooting

If deployments fail, check:
1. All services are running: `systemctl status redis postgresql nginx`
2. Redis connection: `redis-cli ping`
3. Firewall allows connections
4. Disk space available