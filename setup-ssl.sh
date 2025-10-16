#!/bin/bash
set -e

# SSL Certificate Setup Script for Sanbox
# Sets up Let's Encrypt SSL certificates using Certbot
# Usage: ./setup-ssl.sh <domain-name> <email>
#   Example: ./setup-ssl.sh sanbox.esilabs.com admin@esilabs.com

DOMAIN=$1
EMAIL=$2
APP_DIR="/var/www/sanbox"
CERTBOT_DIR="/etc/letsencrypt"

echo "========================================="
echo "🔒 Sanbox SSL Certificate Setup"
echo "========================================="

# Validate arguments
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Error: Missing required arguments"
    echo ""
    echo "Usage: ./setup-ssl.sh <domain-name> <email>"
    echo "Example: ./setup-ssl.sh sanbox.esilabs.com admin@esilabs.com"
    echo ""
    exit 1
fi

echo "📋 Configuration:"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  App Directory: $APP_DIR"
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

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "⚠️  Certbot is not installed. Installing..."

    # Detect OS and install certbot
    if [ -f /etc/redhat-release ]; then
        # RHEL/CentOS - detect version
        if grep -q "release 8" /etc/redhat-release; then
            # RHEL 8
            echo "  → Detected RHEL 8, installing EPEL..."
            dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
            dnf install -y certbot
        elif grep -q "release 9" /etc/redhat-release; then
            # RHEL 9
            echo "  → Detected RHEL 9, installing EPEL..."
            dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
            dnf install -y certbot
        else
            # Older RHEL/CentOS (6, 7)
            echo "  → Detected older RHEL/CentOS, using yum..."
            yum install -y epel-release
            yum install -y certbot
        fi
    elif [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot
    else
        echo "❌ Unsupported OS. Please install certbot manually."
        exit 1
    fi
fi
echo "✅ Certbot: $(certbot --version)"

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

# Create certbot directories
echo ""
echo "📁 Creating directories for Let's Encrypt..."
mkdir -p /var/www/certbot
mkdir -p "$CERTBOT_DIR/live"
mkdir -p "$CERTBOT_DIR/archive"
echo "✅ Directories created"

# Stop nginx temporarily to allow certbot standalone mode
echo ""
echo "🛑 Temporarily stopping frontend container for certificate generation..."
docker-compose stop frontend

# Generate SSL certificate using certbot standalone mode
echo ""
echo "🔐 Generating SSL certificate..."
echo "   This will verify domain ownership with Let's Encrypt"
echo ""

certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --preferred-challenges http

if [ $? -ne 0 ]; then
    echo "❌ Certificate generation failed"
    echo "   Make sure:"
    echo "   1. Domain $DOMAIN points to this server's IP"
    echo "   2. Ports 80 and 443 are open in firewall"
    echo "   3. No other service is using port 80"
    docker-compose start frontend
    exit 1
fi

echo "✅ Certificate generated successfully!"

# Set correct permissions on certificate files
chmod -R 755 "$CERTBOT_DIR"

# Update nginx configuration with the domain name
echo ""
echo "📝 Configuring nginx for HTTPS..."

# Copy SSL config template and replace domain placeholder
cp nginx/nginx-ssl.conf nginx/nginx-ssl-active.conf
sed -i "s/DOMAIN_NAME/$DOMAIN/g" nginx/nginx-ssl-active.conf
sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx/nginx-ssl-active.conf

echo "✅ Nginx configuration updated"

# Update docker-compose to use SSL config and mount certificates
echo ""
echo "🐳 Updating Docker Compose configuration..."

# Backup existing docker-compose.yml
cp docker-compose.yml docker-compose.yml.backup

# Add SSL configuration to docker-compose.yml
cat > docker-compose-ssl-patch.yml <<EOF
version: '3.8'

services:
  frontend:
    ports:
      - "80:8080"
      - "443:8443"
    volumes:
      - static_files:/app/static:ro
      - media_files:/app/media:ro
      - $CERTBOT_DIR:/etc/letsencrypt:ro
      - ./nginx/nginx-ssl-active.conf:/etc/nginx/conf.d/default.conf:ro
      - /var/www/certbot:/var/www/certbot:ro
EOF

echo "✅ Docker Compose patch created"

# Restart containers with new configuration
echo ""
echo "🔄 Restarting containers with HTTPS configuration..."
docker-compose -f docker-compose.yml -f docker-compose-ssl-patch.yml up -d

# Wait for containers to be healthy
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Verify HTTPS is working
echo ""
echo "🏥 Testing HTTPS configuration..."
if curl -k -s "https://$DOMAIN/health" | grep -q "healthy"; then
    echo "✅ HTTPS is working correctly!"
else
    echo "⚠️  HTTPS health check failed, but this may be normal if DNS hasn't propagated"
fi

# Set up automatic certificate renewal
echo ""
echo "🔄 Setting up automatic certificate renewal..."

# Create renewal script
cat > /usr/local/bin/renew-sanbox-ssl.sh <<'RENEWAL_SCRIPT'
#!/bin/bash
# Automatic SSL certificate renewal for Sanbox

APP_DIR="/var/www/sanbox"
cd "$APP_DIR"

# Stop frontend temporarily
docker-compose stop frontend

# Renew certificate
certbot renew --quiet --standalone

# Restart frontend
docker-compose start frontend

# Reload nginx configuration
docker-compose exec frontend nginx -s reload

echo "$(date): SSL certificate renewal completed" >> /var/log/sanbox-ssl-renewal.log
RENEWAL_SCRIPT

chmod +x /usr/local/bin/renew-sanbox-ssl.sh

# Add cron job for automatic renewal (runs twice daily)
if ! crontab -l 2>/dev/null | grep -q "renew-sanbox-ssl.sh"; then
    (crontab -l 2>/dev/null; echo "0 0,12 * * * /usr/local/bin/renew-sanbox-ssl.sh") | crontab -
    echo "✅ Automatic renewal configured (runs twice daily)"
else
    echo "✅ Automatic renewal already configured"
fi

# Update .env with HTTPS URLs
echo ""
echo "📝 Updating environment configuration..."
if [ -f "$APP_DIR/.env" ]; then
    # Backup .env
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup"

    # Add HTTPS to CORS and CSRF settings
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://$DOMAIN,http://$DOMAIN|g" "$APP_DIR/.env"
    sed -i "s|CSRF_TRUSTED_ORIGINS=.*|CSRF_TRUSTED_ORIGINS=https://$DOMAIN,http://$DOMAIN|g" "$APP_DIR/.env"

    echo "✅ Environment configuration updated"
fi

# Display certificate information
echo ""
echo "========================================="
echo "✅ SSL Setup Completed!"
echo "========================================="
echo ""
echo "📋 Certificate Information:"
certbot certificates -d "$DOMAIN"
echo ""
echo "🌐 Your application is now accessible at:"
echo "   https://$DOMAIN"
echo ""
echo "🔒 Certificate Details:"
echo "   Certificate: $CERTBOT_DIR/live/$DOMAIN/fullchain.pem"
echo "   Private Key: $CERTBOT_DIR/live/$DOMAIN/privkey.pem"
echo "   Expires: $(openssl x509 -enddate -noout -in $CERTBOT_DIR/live/$DOMAIN/cert.pem | cut -d= -f2)"
echo ""
echo "🔄 Automatic Renewal:"
echo "   Status: Enabled (runs twice daily)"
echo "   Test renewal: certbot renew --dry-run"
echo "   Manual renewal: /usr/local/bin/renew-sanbox-ssl.sh"
echo "   Renewal log: /var/log/sanbox-ssl-renewal.log"
echo ""
echo "📝 Configuration Files:"
echo "   Nginx config: $APP_DIR/nginx/nginx-ssl-active.conf"
echo "   Docker Compose: $APP_DIR/docker-compose.yml + docker-compose-ssl-patch.yml"
echo ""
echo "⚠️  Important Notes:"
echo "   1. Make sure firewall allows ports 80 and 443"
echo "   2. DNS must point $DOMAIN to this server"
echo "   3. Certificate will auto-renew before expiration"
echo "   4. Backup of original docker-compose.yml saved"
echo ""
echo "========================================="
echo "🎉 HTTPS setup complete!"
echo "========================================="
