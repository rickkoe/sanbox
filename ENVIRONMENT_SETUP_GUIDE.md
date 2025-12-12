# Sanbox - Multi-Environment Setup Guide

## Current Environment Structure

You have three environments:
1. **Local Development (Mac)** - Uses `settings.py` directly
2. **Test Server (Lab)** - Should use `settings_docker.py` or secure settings
3. **Production Server (Lab)** - Should use `settings_production.py` with security fixes

## 🚨 Critical Security Issues Found

### In `settings_production.py`:
- **Line 9**: Hardcoded database password (CRITICAL)
- **Line 27**: `ALLOWED_HOSTS = ['*']` (HIGH RISK)
- Missing security headers

### In `settings.py`:
- **Line 23**: Hardcoded SECRET_KEY (OK for local dev, but should document)
- **Line 28**: `ALLOWED_HOSTS = ['*']` (OK for local dev)

## Recommended Setup

### For Local Development (Mac) - NO CHANGES NEEDED
Keep using `settings.py` as-is. This is fine for local development:
- DEBUG=True (enables hot-reload)
- ALLOWED_HOSTS=['*'] (OK for local)
- SQLite database (fast for development)

### For Test/Production Servers
Use environment variables to avoid hardcoded secrets.

## Implementation Plan

I'll create:
1. **Secure settings_production.py** - Uses environment variables
2. **Environment-specific .env files** - For test and prod servers
3. **Documentation** - How to deploy to each environment