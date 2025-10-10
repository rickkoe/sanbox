#!/bin/bash
set -e

# Build and Push script for Container Registry deployment
# Builds images locally and pushes to container registry
# Usage: ./build-and-push.sh <version-tag> [registry]
#   ./build-and-push.sh v1.2.3
#   ./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox
#   ./build-and-push.sh latest docker.io/your-org/sanbox

VERSION_TAG=$1
REGISTRY=${2:-""}

if [ -z "$VERSION_TAG" ]; then
    echo "❌ Error: Version tag is required"
    echo "Usage: ./build-and-push.sh <version-tag> [registry]"
    echo "Example: ./build-and-push.sh v1.2.3"
    echo "Example: ./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox"
    exit 1
fi

echo "========================================="
echo "🏗️  Build and Push to Registry"
echo "========================================="
echo "Version: $VERSION_TAG"
if [ ! -z "$REGISTRY" ]; then
    echo "Registry: $REGISTRY"
else
    echo "Registry: Local only (use docker-compose.yml image names)"
fi
echo "========================================="

# Check if on correct version
echo ""
echo "📍 Checking git status..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "  Current branch: $CURRENT_BRANCH"
echo "  Current commit: $CURRENT_COMMIT"

# Ask to checkout version if not already
if [ "$VERSION_TAG" != "latest" ]; then
    echo ""
    read -p "Checkout git tag '$VERSION_TAG'? (y/N): " checkout_tag
    if [[ $checkout_tag =~ ^[Yy]$ ]]; then
        echo "  → Fetching tags..."
        git fetch --all --tags
        echo "  → Checking out $VERSION_TAG..."
        git checkout tags/$VERSION_TAG
        echo "✅ Checked out $VERSION_TAG"
    fi
fi

# Get build info
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo ""
echo "📦 Build Information:"
echo "  Version: $VERSION_TAG"
echo "  Commit: $COMMIT_HASH"
echo "  Date: $BUILD_DATE"

# Determine image names
if [ ! -z "$REGISTRY" ]; then
    BACKEND_IMAGE="${REGISTRY}/backend"
    FRONTEND_IMAGE="${REGISTRY}/frontend"
    NGINX_IMAGE="${REGISTRY}/nginx"
else
    BACKEND_IMAGE="sanbox-backend"
    FRONTEND_IMAGE="sanbox-frontend"
    NGINX_IMAGE="sanbox-nginx"
fi

echo ""
echo "🏷️  Image Tags:"
echo "  Backend:  ${BACKEND_IMAGE}:${VERSION_TAG}"
echo "  Frontend: ${FRONTEND_IMAGE}:${VERSION_TAG}"
echo "  Nginx:    ${NGINX_IMAGE}:${VERSION_TAG}"

# Build images
echo ""
echo "🏗️  Building Docker images..."

echo "  → Building backend..."
docker build \
    --target production \
    --tag ${BACKEND_IMAGE}:${VERSION_TAG} \
    --tag ${BACKEND_IMAGE}:latest \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg VERSION="${VERSION_TAG}" \
    --build-arg COMMIT_HASH="${COMMIT_HASH}" \
    -f backend/Dockerfile \
    backend/

echo "  → Building frontend..."
docker build \
    --target production \
    --tag ${FRONTEND_IMAGE}:${VERSION_TAG} \
    --tag ${FRONTEND_IMAGE}:latest \
    --build-arg REACT_APP_VERSION="${VERSION_TAG}" \
    --build-arg REACT_APP_BUILD_DATE="${BUILD_DATE}" \
    --build-arg REACT_APP_COMMIT_HASH="${COMMIT_HASH}" \
    -f frontend/Dockerfile \
    frontend/

echo "  → Building nginx..."
docker build \
    --tag ${NGINX_IMAGE}:${VERSION_TAG} \
    --tag ${NGINX_IMAGE}:latest \
    -f nginx/Dockerfile \
    nginx/

echo "✅ Images built successfully!"

# List images
echo ""
echo "📋 Built Images:"
docker images | grep -E "(${BACKEND_IMAGE}|${FRONTEND_IMAGE}|${NGINX_IMAGE})" | grep -E "(${VERSION_TAG}|latest)"

# Push to registry if specified
if [ ! -z "$REGISTRY" ]; then
    echo ""
    read -p "Push images to registry? (y/N): " push_images
    if [[ $push_images =~ ^[Yy]$ ]]; then
        echo ""
        echo "📤 Pushing images to registry..."

        echo "  → Pushing ${BACKEND_IMAGE}:${VERSION_TAG}..."
        docker push ${BACKEND_IMAGE}:${VERSION_TAG}
        docker push ${BACKEND_IMAGE}:latest

        echo "  → Pushing ${FRONTEND_IMAGE}:${VERSION_TAG}..."
        docker push ${FRONTEND_IMAGE}:${VERSION_TAG}
        docker push ${FRONTEND_IMAGE}:latest

        echo "  → Pushing ${NGINX_IMAGE}:${VERSION_TAG}..."
        docker push ${NGINX_IMAGE}:${VERSION_TAG}
        docker push ${NGINX_IMAGE}:latest

        echo "✅ Images pushed successfully!"

        echo ""
        echo "========================================="
        echo "✅ Build and Push Complete!"
        echo "========================================="
        echo ""
        echo "📦 Registry Images:"
        echo "  ${BACKEND_IMAGE}:${VERSION_TAG}"
        echo "  ${FRONTEND_IMAGE}:${VERSION_TAG}"
        echo "  ${NGINX_IMAGE}:${VERSION_TAG}"
        echo ""
        echo "📋 Next Steps:"
        echo "  On production server, run:"
        echo "  ./deploy-container-remote.sh ${VERSION_TAG} ${REGISTRY}"
        echo ""
    else
        echo "ℹ️  Skipping push to registry"
    fi
else
    echo ""
    echo "========================================="
    echo "✅ Build Complete (Local Only)"
    echo "========================================="
    echo ""
    echo "📋 Next Steps:"
    echo "  For local deployment:"
    echo "    docker-compose up -d"
    echo ""
    echo "  To push to registry:"
    echo "    ./build-and-push.sh ${VERSION_TAG} <registry-url>"
    echo ""
fi

# Save build manifest
BUILD_MANIFEST="build-manifest-${VERSION_TAG}.json"
cat > "$BUILD_MANIFEST" <<EOF
{
  "version": "$VERSION_TAG",
  "commit": "$COMMIT_HASH",
  "buildDate": "$BUILD_DATE",
  "images": {
    "backend": "${BACKEND_IMAGE}:${VERSION_TAG}",
    "frontend": "${FRONTEND_IMAGE}:${VERSION_TAG}",
    "nginx": "${NGINX_IMAGE}:${VERSION_TAG}"
  },
  "registry": "${REGISTRY}"
}
EOF

echo "💾 Build manifest saved: $BUILD_MANIFEST"
echo "========================================="
