#!/bin/bash
set -e

# Self-Signed SSL Certificate Setup Script for Sanbox
# For internal-only servers accessed via VPN
# Usage: ./setup-ssl-selfsigned.sh <domain-name>
#   Example: ./setup-ssl-selfsigned.sh ibmdev03.esilabs.com

DOMAIN=$1
APP_DIR="/var/www/sanbox"
CERT_DIR="/etc/ssl/sanbox"

echo "========================================="
echo "🔒 Sanbox Self-Signed SSL Setup"
echo "========================================="

# Validate arguments
if [ -z "$DOMAIN" ]; then
    echo "❌ Error: Missing domain name"
    echo ""
    echo "Usage: ./setup-ssl-selfsigned.sh <domain-name>"
    echo "Example: ./setup-ssl-selfsigned.sh ibmdev03.esilabs.com"
    echo ""
    exit 1
fi

echo "📋 Configuration:"
echo "  Domain: $DOMAIN"
echo "  App Directory: $APP_DIR"
echo "  Certificate Directory: $CERT_DIR"
echo "========================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root or with sudo"
    exit 1
fi

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose: $(docker-compose --version)"

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed"
    exit 1
fi
echo "✅ OpenSSL: $(openssl version)"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "❌ App directory not found: $APP_DIR"
    echo "   Please run ./deploy-container.sh first"
    exit 1
fi
echo "✅ App directory exists"

# Check if containers are running
cd "$APP_DIR"
if ! docker-compose ps | grep -q "Up"; then
    echo "⚠️  Containers are not running. Starting them..."
    docker-compose up -d
    sleep 10
fi
echo "✅ Containers are running"

# Create certificate directory
echo ""
echo "📁 Creating certificate directory..."
mkdir -p "$CERT_DIR"
echo "✅ Certificate directory created: $CERT_DIR"

# Generate self-signed certificate
echo ""
echo "🔐 Generating self-signed SSL certificate..."
echo "   This certificate will be valid for 365 days"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN"

if [ $? -eq 0 ]; then
    echo "✅ Certificate generated successfully"
else
    echo "❌ Certificate generation failed"
    exit 1
fi

# Set correct permissions
chmod 644 "$CERT_DIR/fullchain.pem"
chmod 600 "$CERT_DIR/privkey.pem"
echo "✅ Permissions set correctly"

# Create nginx SSL configuration
echo ""
echo "📝 Configuring nginx for HTTPS..."

# Create nginx SSL config from template
cat > "$APP_DIR/nginx/nginx-ssl-selfsigned.conf" <<'EOF'
# Nginx configuration for production with self-signed SSL certificate
# For internal servers accessed via VPN

upstream django_backend {
    server backend:8000;
}

# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name _;

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;
    client_max_body_size 100M;

    # Self-signed SSL certificate
    ssl_certificate /etc/ssl/sanbox/fullchain.pem;
    ssl_certificate_key /etc/ssl/sanbox/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Serve React frontend static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to Django backend
    location /api/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        # Timeouts for long-running requests
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Proxy Django admin
    location /admin/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Serve Django static files
    location /django-static/ {
        alias /app/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve Django media files
    location /media/ {
        alias /app/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

echo "✅ Nginx configuration created"

# Update docker-compose to use SSL config and mount certificates
echo ""
echo "🐳 Updating Docker Compose configuration..."

# Backup existing docker-compose.yml
cp docker-compose.yml docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)

# Check if SSL configuration is already in docker-compose.yml
if grep -q "443:8443" docker-compose.yml; then
    echo "  → SSL configuration already exists in docker-compose.yml"
else
    echo "  → Adding SSL configuration to docker-compose.yml"

    # Uncomment SSL lines in docker-compose.yml
    sed -i 's|# - "443:8443"|      - "443:8443"|g' docker-compose.yml
    sed -i 's|# - /etc/ssl/sanbox:/etc/ssl/sanbox:ro|      - /etc/ssl/sanbox:/etc/ssl/sanbox:ro|g' docker-compose.yml
    sed -i 's|# - ./nginx/nginx-ssl-selfsigned.conf:/etc/nginx/conf.d/default.conf:ro|      - ./nginx/nginx-ssl-selfsigned.conf:/etc/nginx/conf.d/default.conf:ro|g' docker-compose.yml
fi

echo "✅ Docker Compose configuration updated"

# Update .env with HTTPS URLs
echo ""
echo "📝 Updating environment configuration..."
if [ -f "$APP_DIR/.env" ]; then
    # Backup .env
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup-$(date +%Y%m%d-%H%M%S)"

    # Update CORS and CSRF settings to include the domain with HTTPS
    # Keep existing localhost entries and add the new domain
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://$DOMAIN,http://$DOMAIN,http://localhost:3000,http://127.0.0.1:3000|g" "$APP_DIR/.env"
    sed -i "s|CSRF_TRUSTED_ORIGINS=.*|CSRF_TRUSTED_ORIGINS=https://$DOMAIN,http://$DOMAIN,http://localhost:3000,http://127.0.0.1:3000|g" "$APP_DIR/.env"
    echo "  → Updated CORS and CSRF settings for HTTPS with domain: $DOMAIN"
else
    echo "  → .env file not found (this is okay - defaults will be used)"
fi
echo "✅ Environment configuration updated"

# Restart containers with new configuration
echo ""
echo "🔄 Restarting containers with HTTPS configuration..."
docker-compose down
docker-compose up -d

# Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Test HTTPS
echo ""
echo "🏥 Testing HTTPS configuration..."
if curl -k -s "https://localhost/health" | grep -q "healthy"; then
    echo "✅ HTTPS is working correctly!"
else
    echo "⚠️  HTTPS health check returned unexpected response"
fi

# Display certificate information
echo ""
echo "========================================="
echo "✅ SSL Setup Completed!"
echo "========================================="
echo ""
echo "🌐 Your application is now accessible at:"
echo "   https://$DOMAIN"
echo ""
echo "🔒 Certificate Details:"
echo "   Type: Self-Signed (for internal use)"
echo "   Location: $CERT_DIR/fullchain.pem"
echo "   Private Key: $CERT_DIR/privkey.pem"
echo "   Valid for: 365 days"
echo "   Expires: $(date -d '+365 days' '+%Y-%m-%d' 2>/dev/null || date -v+365d '+%Y-%m-%d')"
echo ""
echo "⚠️  Browser Security Warning:"
echo "   Because this is a self-signed certificate, browsers will show"
echo "   a security warning. This is normal for internal servers."
echo ""
echo "   To proceed in browsers:"
echo "   - Chrome/Edge: Click 'Advanced' → 'Proceed to $DOMAIN (unsafe)'"
echo "   - Firefox: Click 'Advanced' → 'Accept the Risk and Continue'"
echo "   - Safari: Click 'Show Details' → 'visit this website'"
echo ""
echo "   For a better experience, you can:"
echo "   1. Add the certificate to your browser's trusted certificates"
echo "   2. Or distribute the certificate to users' systems"
echo ""
echo "📝 Configuration Files:"
echo "   Nginx config: $APP_DIR/nginx/nginx-ssl-selfsigned.conf"
echo "   Docker Compose: $APP_DIR/docker-compose.yml"
echo "   Backups saved with timestamp"
echo ""
echo "🔄 Certificate Renewal:"
echo "   Self-signed certificates expire in 365 days"
echo "   To renew, run this script again before expiration"
echo ""
echo "========================================="
echo "🎉 HTTPS setup complete!"
echo "========================================="
