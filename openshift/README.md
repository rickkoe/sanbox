# OpenShift Deployment Guide for Sanbox

This directory contains Kubernetes/OpenShift manifests for deploying the Sanbox application to OpenShift.

## Prerequisites

- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster
- Docker images built and pushed to a registry accessible by OpenShift
- Storage class available that supports ReadWriteMany for shared volumes

## Quick Start

### 1. Create a New Project

```bash
oc new-project sanbox-production
```

### 2. Create Secrets

Create the secrets file from the example:

```bash
cp secrets.yaml.example secrets.yaml
```

Edit `secrets.yaml` and update with your actual secrets, or create directly:

```bash
# Generate Django secret key
DJANGO_SECRET=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')

# Create secret
oc create secret generic sanbox-secrets \
  --from-literal=DJANGO_SECRET_KEY="$DJANGO_SECRET" \
  --from-literal=POSTGRES_USER='sanbox_user' \
  --from-literal=POSTGRES_PASSWORD='your-secure-password-here'
```

### 3. Update ConfigMap

Edit `configmaps.yaml` and update:
- `CSRF_TRUSTED_ORIGINS` with your actual OpenShift route domain
- `ALLOWED_HOSTS` if needed
- Any other environment-specific settings

### 4. Create ConfigMap

```bash
oc apply -f configmaps.yaml
```

### 5. Create Persistent Volume Claims

```bash
oc apply -f pvc.yaml
```

### 6. Tag and Push Docker Images

Build and tag your images:

```bash
# Build images
./build.sh production

# Tag for your registry
docker tag sanbox-backend:latest your-registry/sanbox-backend:latest
docker tag sanbox-nginx:latest your-registry/sanbox-nginx:latest

# Push to registry
docker push your-registry/sanbox-backend:latest
docker push your-registry/sanbox-nginx:latest
```

Update `deployment.yaml` with your registry image paths.

### 7. Create Services

```bash
oc apply -f services.yaml
```

### 8. Create Deployments

```bash
oc apply -f deployment.yaml
```

### 9. Create Routes

```bash
oc apply -f routes.yaml
```

### 10. Verify Deployment

```bash
# Check all resources
oc get all

# Check pod status
oc get pods

# Check logs
oc logs -f deployment/backend
oc logs -f deployment/nginx

# Check route
oc get route sanbox
```

## Complete Deployment Command

Deploy everything at once:

```bash
# Create project
oc new-project sanbox-production

# Apply all manifests
oc apply -f configmaps.yaml
oc apply -f secrets.yaml  # Make sure you've created this from the example
oc apply -f pvc.yaml
oc apply -f services.yaml
oc apply -f deployment.yaml
oc apply -f routes.yaml
```

## Post-Deployment Tasks

### Run Database Migrations

```bash
# Migrations run automatically via initContainer, but you can run manually:
oc exec -it deployment/backend -- python manage.py migrate
```

### Create Django Superuser

```bash
oc exec -it deployment/backend -- python manage.py createsuperuser
```

### Collect Static Files

```bash
# Static files are collected during image build, but you can run manually:
oc exec -it deployment/backend -- python manage.py collectstatic --noinput
```

## Scaling

### Scale Backend

```bash
oc scale deployment/backend --replicas=3
```

### Scale Celery Workers

```bash
oc scale deployment/celery-worker --replicas=4
```

### Scale Nginx

```bash
oc scale deployment/nginx --replicas=2
```

## Monitoring

### View Logs

```bash
# Backend logs
oc logs -f deployment/backend

# Celery worker logs
oc logs -f deployment/celery-worker

# Celery beat logs
oc logs -f deployment/celery-beat

# Nginx logs
oc logs -f deployment/nginx

# PostgreSQL logs
oc logs -f statefulset/postgres
```

### Check Pod Status

```bash
oc get pods
oc describe pod <pod-name>
```

### Check Events

```bash
oc get events --sort-by='.lastTimestamp'
```

## Troubleshooting

### Database Connection Issues

```bash
# Check database pod
oc get pods -l component=database

# Check database logs
oc logs -f statefulset/postgres

# Test database connection from backend
oc exec -it deployment/backend -- python manage.py dbshell
```

### Permission Issues

If pods fail due to permission issues:

```bash
# Check SecurityContextConstraints
oc get scc

# Add the default service account to anyuid SCC (if needed)
oc adm policy add-scc-to-user anyuid -z default
```

### Image Pull Errors

```bash
# Check image pull secrets
oc get secrets

# Create image pull secret if needed
oc create secret docker-registry regcred \
  --docker-server=<your-registry> \
  --docker-username=<username> \
  --docker-password=<password>

# Link to service account
oc secrets link default regcred --for=pull
```

### Storage Issues

```bash
# Check PVCs
oc get pvc

# Check PV binding
oc get pv

# Describe PVC for details
oc describe pvc media-files
```

## Updating the Application

### Update Images

```bash
# Build and push new images
./build.sh production
docker tag sanbox-backend:latest your-registry/sanbox-backend:v1.1.0
docker push your-registry/sanbox-backend:v1.1.0

# Update deployment
oc set image deployment/backend backend=your-registry/sanbox-backend:v1.1.0

# Or trigger a rollout
oc rollout restart deployment/backend
```

### Rollback Deployment

```bash
# View rollout history
oc rollout history deployment/backend

# Rollback to previous version
oc rollout undo deployment/backend

# Rollback to specific revision
oc rollout undo deployment/backend --to-revision=2
```

## Cleanup

### Delete All Resources

```bash
# Delete all resources in the project
oc delete all --all

# Delete PVCs (WARNING: This deletes data!)
oc delete pvc --all

# Delete project
oc delete project sanbox-production
```

## Security Considerations

1. **Secrets Management**: Never commit `secrets.yaml` to version control
2. **TLS/SSL**: Routes are configured with edge termination - ensure your cluster has valid certificates
3. **Network Policies**: Consider implementing network policies to restrict pod-to-pod communication
4. **Security Context**: All pods run as non-root user (UID 1001) for security
5. **Resource Limits**: All deployments have resource limits defined to prevent resource exhaustion

## Additional Resources

- [OpenShift Documentation](https://docs.openshift.com/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
