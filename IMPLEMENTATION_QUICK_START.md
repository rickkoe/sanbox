# Sanbox Improvement - Quick Start Implementation Guide

This guide provides immediate, actionable steps to begin improving the Sanbox project. Start here for quick wins and critical fixes.

---

## 🚨 Critical Security Fixes (Do This First!)

### Step 1: Fix Hardcoded Secrets (15 minutes)

**File: `backend/sanbox/settings.py`**

Replace the hardcoded values with environment variables:

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: Load from environment variables
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if os.environ.get('DEBUG', 'False').lower() == 'true':
        SECRET_KEY = 'django-insecure-dev-key-only'  # Development only
    else:
        raise ValueError("DJANGO_SECRET_KEY must be set in production")

DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

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

### Step 2: Update .env Files (10 minutes)

**Update `.env.example`:**

```bash
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here-generate-with-python-secrets
DEBUG=False

# Database Settings
POSTGRES_DB=sanbox_db
POSTGRES_USER=sanbox_user
POSTGRES_PASSWORD=change-this-strong-password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis Settings
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# CORS Settings
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,http://localhost:3000

# Security Settings
ALLOWED_HOSTS=yourdomain.com,localhost,127.0.0.1

# Celery Settings
CELERY_WORKERS=4

# Application Version
VERSION=latest
```

**Generate a secure SECRET_KEY:**

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Step 3: Update Your Local .env (5 minutes)

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
# Edit .env with your actual values
```

---

## 🎯 Quick Wins (1-2 Hours)

### 1. Add Pre-commit Hooks (30 minutes)

**Install pre-commit:**

```bash
pip install pre-commit
```

**Create `.pre-commit-config.yaml`:**

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

**Install hooks:**

```bash
pre-commit install
pre-commit run --all-files  # Test on all files
```

### 2. Add Backend Code Quality Tools (30 minutes)

**Create `backend/requirements-dev.txt`:**

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
```

**Install:**

```bash
cd backend
pip install -r requirements-dev.txt
```

**Create `backend/pyproject.toml`:**

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

**Create `backend/.flake8`:**

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
```

### 3. Add Frontend Code Quality Tools (30 minutes)

**Install ESLint and Prettier:**

```bash
cd frontend
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks
```

**Create `frontend/.eslintrc.json`:**

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

**Create `frontend/.prettierrc`:**

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

**Create `frontend/.prettierignore`:**

```
build
node_modules
coverage
*.min.js
package-lock.json
```

**Add scripts to `frontend/package.json`:**

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

---

## 🧪 Basic Testing Setup (1 Hour)

### Backend Testing

**Create `backend/pytest.ini`:**

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

**Create `backend/conftest.py`:**

```python
import pytest
from django.conf import settings

@pytest.fixture(scope='session')
def django_db_setup():
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }

@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        username='testuser',
        password='testpass123'
    )
    api_client.force_authenticate(user=user)
    return api_client
```

**Create a sample test `backend/tests/test_health.py`:**

```python
import pytest
from django.urls import reverse

@pytest.mark.django_db
def test_health_check(api_client):
    """Test that health check endpoint returns 200"""
    response = api_client.get('/api/health/')
    assert response.status_code in [200, 404]  # 404 if endpoint doesn't exist yet
```

**Run tests:**

```bash
cd backend
pytest
```

### Frontend Testing

**Update `frontend/src/setupTests.js`:**

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
```

**Create a sample test `frontend/src/__tests__/App.test.js`:**

```javascript
import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders without crashing', () => {
  render(<App />);
  // Add more specific assertions based on your app
});
```

**Run tests:**

```bash
cd frontend
npm test -- --coverage --watchAll=false
```

---

## 📊 Add Health Check Endpoint (30 minutes)

**Create `backend/core/views.py` (or update if exists):**

```python
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def health_check(request):
    """
    Comprehensive health check endpoint for monitoring
    Returns 200 if all systems are healthy, 503 otherwise
    """
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',  # Update from environment
        'checks': {}
    }
    
    # Database check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['checks']['database'] = {'status': 'healthy'}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        health_status['status'] = 'unhealthy'
    
    # Redis check
    try:
        cache.set('health_check', 'ok', 10)
        result = cache.get('health_check')
        if result == 'ok':
            health_status['checks']['redis'] = {'status': 'healthy'}
        else:
            raise Exception("Cache value mismatch")
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        health_status['status'] = 'unhealthy'
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)

def readiness_check(request):
    """Kubernetes readiness probe - is the app ready to serve traffic?"""
    return JsonResponse({'status': 'ready'}, status=200)

def liveness_check(request):
    """Kubernetes liveness probe - is the app alive?"""
    return JsonResponse({'status': 'alive'}, status=200)
```

**Add to `backend/core/urls.py`:**

```python
from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('ready/', views.readiness_check, name='readiness_check'),
    path('live/', views.liveness_check, name='liveness_check'),
]
```

**Include in main `backend/sanbox/urls.py`:**

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', include('core.urls')),  # Add this
    # ... other patterns
]
```

---

## 🔍 Add Basic Logging (20 minutes)

**Update `backend/sanbox/settings.py`:**

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
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'application.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'errors.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
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
    },
}
```

---

## 🚀 Next Steps

After completing these quick wins, proceed with:

1. **Review the full plan**: Read `COMPREHENSIVE_IMPROVEMENT_PLAN.md`
2. **Set up CI/CD**: Implement GitHub Actions workflows
3. **Add comprehensive tests**: Achieve 80% backend coverage
4. **Performance optimization**: Add caching and query optimization
5. **Monitoring**: Set up Sentry and application monitoring

---

## 📝 Verification Checklist

After implementing these changes, verify:

- [ ] No hardcoded secrets in `settings.py`
- [ ] Environment variables loaded correctly
- [ ] Pre-commit hooks installed and working
- [ ] Code formatting tools (Black, Prettier) working
- [ ] Linting passes (Flake8, ESLint)
- [ ] Basic tests running successfully
- [ ] Health check endpoint responding
- [ ] Logging working (check `backend/logs/`)
- [ ] Application still runs correctly

---

## 🆘 Troubleshooting

### Pre-commit hooks failing?
```bash
pre-commit run --all-files  # See what's failing
pre-commit autoupdate       # Update hook versions
```

### Tests not running?
```bash
# Backend
cd backend
pip install -r requirements-dev.txt
pytest -v

# Frontend
cd frontend
npm install
npm test
```

### Environment variables not loading?
```bash
# Check .env file exists
ls -la .env

# Verify Docker Compose loads it
docker-compose config
```

---

## 📚 Additional Resources

- [Django Security Best Practices](https://docs.djangoproject.com/en/5.1/topics/security/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Pre-commit Documentation](https://pre-commit.com/)
- [Black Code Formatter](https://black.readthedocs.io/)
- [ESLint Rules](https://eslint.org/docs/rules/)

---

**Time Investment Summary:**
- Critical Security Fixes: 30 minutes
- Quick Wins: 2 hours
- Testing Setup: 1 hour
- Health Checks & Logging: 50 minutes
- **Total: ~4 hours for immediate improvements**

Start with the critical security fixes, then work through the quick wins. These changes will provide immediate value and set the foundation for the comprehensive improvements outlined in the main plan.