# Multi-stage Dockerfile for Django backend using Alpine (faster, smaller)
# Supports both development and production modes

# Builder stage - compile Python packages
FROM python:3.12-alpine as builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies (Alpine packages are tiny and fast)
RUN apk add --no-cache \
    gcc \
    musl-dev \
    postgresql-dev \
    linux-headers

WORKDIR /app

# Build Python wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Base stage - runtime environment
FROM python:3.12-alpine as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install only runtime libraries (minimal)
RUN apk add --no-cache \
    postgresql-client \
    libpq \
    bash

# Create non-root user for OpenShift compatibility
RUN adduser -D -u 1001 -s /bin/bash appuser

WORKDIR /app

# Install Python packages from pre-built wheels
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

# Development stage
FROM base as development

# Install development dependencies
RUN pip install --no-cache-dir watchdog

# Set development environment
ENV DJANGO_SETTINGS_MODULE=sanbox.settings_docker \
    DEBUG=True

# Copy application code
COPY --chown=appuser:appuser . .

# Create directories for logs and static files
RUN mkdir -p /app/logs /app/static /app/media && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose Django development server port
EXPOSE 8000

# Run Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# Production stage
FROM base as production

# Install production server
RUN pip install --no-cache-dir gunicorn

# Set production environment
ENV DJANGO_SETTINGS_MODULE=sanbox.settings_docker \
    DEBUG=False

# Copy application code
COPY --chown=appuser:appuser . .

# Create directories for logs and static files
RUN mkdir -p /app/logs /app/static /app/media && \
    chown -R appuser:appuser /app

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Switch to non-root user
USER appuser

# Expose Gunicorn port
EXPOSE 8000

# Run Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "sanbox.wsgi:application"]
