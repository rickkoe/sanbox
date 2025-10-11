# Multi-stage Dockerfile for React frontend
# Supports both development and production modes

# Base stage - dependencies
FROM node:18-alpine as base

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY .npmrc* ./

# Development stage
FROM base as development

# Install all dependencies (including dev dependencies)
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Expose React development server port
EXPOSE 3000

# Set environment variable for hot-reload
ENV CHOKIDAR_USEPOLLING=true \
    WDS_SOCKET_PORT=0

# Run development server
CMD ["npm", "start"]

# Builder stage - create production build
FROM base as builder

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Build React app
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine as production

# Create non-root user for OpenShift compatibility
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder --chown=appuser:appuser /app/build /usr/share/nginx/html

# Create nginx cache and pid directories with proper permissions
RUN mkdir -p /var/cache/nginx /run && \
    chown -R appuser:appuser /var/cache/nginx /run /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx /run && \
    touch /run/nginx.pid && \
    chown appuser:appuser /run/nginx.pid

# Update nginx.conf to use non-privileged port and user
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf && \
    sed -i '/user\s*nginx;/d' /etc/nginx/nginx.conf

# Switch to non-root user
USER appuser

# Expose port 8080 (non-privileged for OpenShift)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
