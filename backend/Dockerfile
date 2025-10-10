# Multi-stage Dockerfile for Django backend
# Supports both development and production modes

# Base stage - common dependencies
FROM python:3.13-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for OpenShift compatibility
RUN useradd -m -u 1001 -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

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
