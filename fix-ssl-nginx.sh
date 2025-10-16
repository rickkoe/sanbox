#!/bin/bash
# Quick fix for nginx SSL configuration - listen on 8443 instead of 443

APP_DIR="/var/www/sanbox"
CERT_DIR="/etc/ssl/sanbox"

echo "Fixing nginx SSL configuration to listen on port 8443..."

# Fix the nginx config to listen on 8443 instead of 443
if [ -f "$APP_DIR/nginx/nginx-ssl-selfsigned.conf" ]; then
    sed -i 's/listen 443 ssl http2;/listen 8443 ssl http2;/g' "$APP_DIR/nginx/nginx-ssl-selfsigned.conf"
    echo "✅ Updated nginx config to listen on port 8443"
else
    echo "❌ Error: nginx-ssl-selfsigned.conf not found"
    exit 1
fi

echo "Fixing SSL certificate file permissions..."
# Set correct permissions for SSL certificates so nginx can read them
if [ -d "$CERT_DIR" ]; then
    chmod 755 "$CERT_DIR"
    chmod 644 "$CERT_DIR/fullchain.pem"
    chmod 644 "$CERT_DIR/privkey.pem"
    echo "✅ Fixed SSL certificate permissions"
else
    echo "❌ Error: $CERT_DIR not found"
    exit 1
fi

# Restart containers to apply changes
echo "Restarting containers..."
cd "$APP_DIR"
docker-compose down
docker-compose up -d

echo "✅ Done! Check status with: docker ps"
echo ""
echo "HTTPS should now be accessible at: https://$(hostname)"
echo ""
echo "If you still see issues, check frontend logs with:"
echo "  docker logs sanbox_frontend --tail 100"
