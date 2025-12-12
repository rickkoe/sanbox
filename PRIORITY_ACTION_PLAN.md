# Sanbox - Priority Action Plan

## 🎯 Overview

This document provides a prioritized, step-by-step action plan for improving the Sanbox project. Each action includes specific files to modify, code examples, and estimated time.

---

## 🚨 CRITICAL PRIORITY (Do First - Week 1)

### Action 1: Fix Security Vulnerabilities (2 hours)

**Risk Level:** 🔴 CRITICAL  
**Impact:** Prevents security breaches  
**Effort:** Medium

#### Files to Modify:

**1. `backend/sanbox/settings.py`**

Replace lines 23-28 with:
```python
import os

# SECURITY: Load from environment variables
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if os.environ.get('DEBUG', 'False').lower() == 'true':
        SECRET_KEY = 'django-insecure-dev-key-only'
    else:
        raise ValueError("DJANGO_SECRET_KEY must be set in production")

DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
```

Replace lines 63-70 with:
```python
# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False').lower() == 'true'
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = [
        origin.strip() 
        for origin in os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
    ]
CORS_ALLOW_CREDENTIALS = True

# Security Settings for Production
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
```

**2. Update `.env` file**

Generate new secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Add to `.env`:
```bash
DJANGO_SECRET_KEY=<generated-key-here>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**3. Update `.env.example`**

Add documentation for all security variables.

#### Verification:
```bash
# Test that settings load correctly
cd backend
python manage.py check --deploy
```

---

### Action 2: Add Structured Logging (1 hour)

**Risk Level:** 🟡 MEDIUM  
**Impact:** Better debugging and monitoring  
**Effort:** Low

#### Files to Create/Modify:

**1. Create `backend/core/logging_config.py`**

```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """Format logs as JSON for better parsing"""
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        return json.dumps(log_data)
```

**2. Update `backend/sanbox/settings.py`**

Add after line 186:
```python
import os
from pathlib import Path

# Create logs directory
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'core.logging_config.JSONFormatter',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose' if DEBUG else 'json',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'application.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'json',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'errors.log',
            'maxBytes': 10485760,
            'backupCount': 5,
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

---

### Action 3: Add Health Check Endpoints (30 minutes)

**Risk Level:** 🟢 LOW  
**Impact:** Essential for monitoring  
**Effort:** Low

#### Files to Create/Modify:

**1. Update `backend/core/views.py`**

Add these views:
```python
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def health_check(request):
    """Comprehensive health check for monitoring"""
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': {}
    }
    
    # Database check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['checks']['database'] = {'status': 'healthy'}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status['checks']['database'] = {'status': 'unhealthy', 'error': str(e)}
        health_status['status'] = 'unhealthy'
    
    # Redis check
    try:
        cache.set('health_check', 'ok', 10)
        if cache.get('health_check') == 'ok':
            health_status['checks']['redis'] = {'status': 'healthy'}
        else:
            raise Exception("Cache value mismatch")
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status['checks']['redis'] = {'status': 'unhealthy', 'error': str(e)}
        health_status['status'] = 'unhealthy'
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)

def readiness_check(request):
    """Kubernetes readiness probe"""
    return JsonResponse({'status': 'ready'}, status=200)

def liveness_check(request):
    """Kubernetes liveness probe"""
    return JsonResponse({'status': 'alive'}, status=200)
```

**2. Create `backend/core/urls.py`**

```python
from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('ready/', views.readiness_check, name='readiness_check'),
    path('live/', views.liveness_check, name='liveness_check'),
]
```

**3. Update `backend/sanbox/urls.py`**

Add to urlpatterns:
```python
path('api/health/', include('core.urls')),
```

#### Verification:
```bash
curl http://localhost:8000/api/health/health/
```

---

## 🟡 HIGH PRIORITY (Week 1-2)

### Action 4: Set Up Code Quality Tools (2 hours)

#### Backend Setup

**1. Create `backend/requirements-dev.txt`**

```txt
# Code Quality
black==23.12.1
flake8==7.0.0
isort==5.13.2
pylint==3.0.3
mypy==1.8.0
bandit==1.7.6

# Testing
pytest==7.4.4
pytest-django==4.7.0
pytest-cov==4.1.0
pytest-mock==3.12.0
factory-boy==3.3.0
faker==22.0.0

# Development
ipython==8.20.0
django-debug-toolbar==4.2.0
django-extensions==3.2.3
```

**2. Create `backend/pyproject.toml`**

```toml
[tool.black]
line-length = 100
target-version = ['py312']
include = '\.pyi?$'
exclude = '''
/(
    \.git
  | \.venv
  | migrations
  | __pycache__
  | build
  | dist
)/
'''

[tool.isort]
profile = "black"
line_length = 100
skip_gitignore = true
known_django = "django"
sections = ["FUTURE", "STDLIB", "DJANGO", "THIRDPARTY", "FIRSTPARTY", "LOCALFOLDER"]

[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "sanbox.settings"
python_files = ["tests.py", "test_*.py", "*_tests.py"]
addopts = "--cov --cov-report=html --cov-report=term-missing --verbose"
testpaths = ["tests"]
```

**3. Create `backend/.flake8`**

```ini
[flake8]
max-line-length = 100
extend-ignore = E203, W503
exclude =
    .git,
    __pycache__,
    migrations,
    .venv,
    venv,
    build,
    dist
per-file-ignores =
    __init__.py:F401
```

#### Frontend Setup

**1. Install dependencies**

```bash
cd frontend
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks
```

**2. Create `frontend/.eslintrc.json`**

```json
{
  "extends": [
    "react-app",
    "react-app/jest",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "react/prop-types": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

**3. Create `frontend/.prettierrc`**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**4. Update `frontend/package.json` scripts**

```json
{
  "scripts": {
    "start": "DANGEROUSLY_DISABLE_HOST_CHECK=true react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src --ext .js,.jsx",
    "lint:fix": "eslint src --ext .js,.jsx --fix",
    "format": "prettier --write \"src/**/*.{js,jsx,json,css,scss,md}\"",
    "format:check": "prettier --check \"src/**/*.{js,jsx,json,css,scss,md}\""
  }
}
```

#### Verification:
```bash
# Backend
cd backend
pip install -r requirements-dev.txt
black --check .
flake8 .
isort --check-only .

# Frontend
cd frontend
npm run lint
npm run format:check
```

---

### Action 5: Set Up Pre-commit Hooks (30 minutes)

**1. Create `.pre-commit-config.yaml`**

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: check-json
      - id: pretty-format-json
        args: ['--autofix', '--no-sort-keys']

  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        files: ^backend/
        args: ['--line-length=100']

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort
        files: ^backend/
        args: ['--profile=black']

  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
        files: ^backend/
        args: ['--max-line-length=100', '--extend-ignore=E203,W503']

  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        files: ^frontend/
        types_or: [javascript, jsx, json, css, scss, markdown]
```

**2. Install and run**

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

---

### Action 6: Basic Testing Infrastructure (3 hours)

#### Backend Tests

**1. Create `backend/pytest.ini`**

```ini
[pytest]
DJANGO_SETTINGS_MODULE = sanbox.settings
python_files = tests.py test_*.py *_tests.py
addopts = 
    --cov=.
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=50
    --verbose
    --strict-markers
testpaths = tests
```

**2. Create `backend/conftest.py`**

```python
import pytest
from django.conf import settings
from rest_framework.test import APIClient

@pytest.fixture(scope='session')
def django_db_setup():
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        username='testuser',
        password='testpass123',
        email='test@example.com'
    )
    api_client.force_authenticate(user=user)
    return api_client, user

@pytest.fixture
def sample_customer(db):
    from customers.models import Customer
    return Customer.objects.create(
        name='Test Customer',
        code='TEST001'
    )
```

**3. Create `backend/tests/test_health.py`**

```python
import pytest
from django.urls import reverse

@pytest.mark.django_db
def test_health_check_endpoint(api_client):
    """Test health check returns 200"""
    response = api_client.get('/api/health/health/')
    assert response.status_code == 200
    assert 'status' in response.json()

@pytest.mark.django_db
def test_readiness_check(api_client):
    """Test readiness probe"""
    response = api_client.get('/api/health/ready/')
    assert response.status_code == 200

@pytest.mark.django_db
def test_liveness_check(api_client):
    """Test liveness probe"""
    response = api_client.get('/api/health/live/')
    assert response.status_code == 200
```

#### Frontend Tests

**1. Update `frontend/src/setupTests.js`**

```javascript
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
```

**2. Create `frontend/src/__tests__/App.test.js`**

```javascript
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

test('renders without crashing', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
});
```

#### Verification:
```bash
# Backend
cd backend
pytest -v

# Frontend
cd frontend
npm test -- --coverage --watchAll=false
```

---

## 🔵 MEDIUM PRIORITY (Week 2-3)

### Action 7: CI/CD Pipeline Setup (4 hours)

**1. Create `.github/workflows/ci.yml`**

```yaml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run linting
        run: |
          cd backend
          black --check .
          flake8 .
          isort --check-only .
      
      - name: Run tests
        run: |
          cd backend
          pytest --cov --cov-report=xml
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
          DJANGO_SECRET_KEY: test-secret-key
          DEBUG: True
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run linting
        run: |
          cd frontend
          npm run lint
      
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/coverage-final.json
          flags: frontend

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

**2. Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

---

## 📊 Progress Tracking

### Week 1 Checklist
- [ ] Action 1: Security fixes completed
- [ ] Action 2: Logging implemented
- [ ] Action 3: Health checks added
- [ ] Action 4: Code quality tools set up
- [ ] Action 5: Pre-commit hooks installed
- [ ] Action 6: Basic tests written

### Week 2 Checklist
- [ ] Action 7: CI/CD pipeline operational
- [ ] Code coverage > 50%
- [ ] All linting passing
- [ ] Security scan clean

### Success Metrics
- ✅ No hardcoded secrets
- ✅ All tests passing
- ✅ CI/CD green
- ✅ Code formatted consistently
- ✅ Health checks responding

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Pre-commit hooks failing**
```bash
pre-commit clean
pre-commit install --install-hooks
pre-commit run --all-files
```

**Issue: Tests not finding modules**
```bash
cd backend
export PYTHONPATH=$PWD:$PYTHONPATH
pytest
```

**Issue: Frontend tests failing**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm test
```

---

## 📈 Next Steps After Priority Actions

1. **Performance Optimization** (Week 3-4)
   - Add database indexes
   - Implement caching
   - Optimize queries

2. **Monitoring Setup** (Week 4-5)
   - Add Sentry
   - Set up Prometheus
   - Create Grafana dashboards

3. **Documentation** (Week 5-6)
   - API documentation
   - Architecture docs
   - Deployment guides

---

This priority action plan provides concrete, actionable steps with specific file changes. Start with the critical security fixes and work your way through the priorities.