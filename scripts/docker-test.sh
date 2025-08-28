#!/bin/bash
set -e

echo "🐳 Testing Docker setup..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_status "Docker is running"

# Build production image
echo "Building production image..."
docker build -t smart-proxy:latest .
print_status "Production image built successfully"

# Check image size
SIZE=$(docker images smart-proxy:latest --format "table {{.Size}}" | tail -1)
echo "📏 Image size: $SIZE"

# Test production container
echo "🧪 Testing production container..."
docker run -d --name smart-proxy-test \
    -p 7778:7777 \
    -e TARGET_URLS="httpbin.org:80" \
    -e TIMEOUT=5000 \
    -e LOG_LEVEL=info \
    smart-proxy:latest

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Test health endpoint
if curl -f -s http://localhost:7778/health > /dev/null; then
    print_status "Health endpoint is working"
else
    print_error "Health endpoint failed"
    docker logs smart-proxy-test
    docker stop smart-proxy-test && docker rm smart-proxy-test
    exit 1
fi

# Test metrics endpoint
if curl -f -s http://localhost:7778/metrics > /dev/null; then
    print_status "Metrics endpoint is working"
else
    print_error "Metrics endpoint failed"
    docker logs smart-proxy-test
    docker stop smart-proxy-test && docker rm smart-proxy-test
    exit 1
fi

# Test container health check
HEALTH_STATUS=$(docker inspect smart-proxy-test --format='{{.State.Health.Status}}')
echo "🏥 Container health status: $HEALTH_STATUS"

# Check container is running as non-root user
USER_INFO=$(docker exec smart-proxy-test id)
echo "👤 Container user: $USER_INFO"

if echo "$USER_INFO" | grep -q "uid=1001(proxy)"; then
    print_status "Container running as non-root user"
else
    print_warning "Container may be running as root"
fi

# Clean up
docker stop smart-proxy-test
docker rm smart-proxy-test

print_status "All Docker tests passed!"

# Optional: Test multi-stage build efficiency
echo "📊 Build analysis:"
docker images | grep smart-proxy

echo ""
echo "🚀 Docker setup is production-ready!"
echo ""
echo "Usage:"
echo "  Production: docker run -p 7777:7777 -e TARGET_URLS=\"host1:port1|host2:port2\" smart-proxy:latest"
echo "  Development: docker-compose -f docker-compose.dev.yml up"
echo "  Full stack: docker-compose up"