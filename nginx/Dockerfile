# Nginx reverse proxy for production
FROM nginx:alpine

# Create non-root user for OpenShift compatibility
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/run/nginx /app/static /app/media /usr/share/nginx/html && \
    chown -R appuser:appuser /var/cache/nginx /var/run/nginx /app /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx /var/run/nginx /app /usr/share/nginx/html && \
    touch /var/run/nginx/nginx.pid && \
    chown appuser:appuser /var/run/nginx/nginx.pid

# Update nginx.conf to run as non-root
RUN sed -i '/user\s*nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's,/var/run/nginx.pid,/var/run/nginx/nginx.pid,' /etc/nginx/nginx.conf && \
    sed -i 's,listen\s*80;,listen 8080;,' /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER appuser

# Expose non-privileged port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
