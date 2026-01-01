#!/bin/bash
# check-docker.sh - Verify Docker is installed and running

set -e

echo "Checking Docker installation..."

# Check if docker command exists
if ! command -v docker &> /dev/null; then
    echo ""
    echo "❌ Docker is not installed or not in PATH"
    echo ""
    echo "Please install Docker Desktop:"
    echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/"
    echo "  - macOS:   https://docs.docker.com/desktop/install/mac-install/"
    echo "  - Linux:   https://docs.docker.com/engine/install/"
    echo ""
    exit 1
fi

# Check if docker daemon is running
if ! docker info &> /dev/null; then
    echo ""
    echo "❌ Docker daemon is not running"
    echo ""
    echo "Please start Docker Desktop and try again."
    echo ""
    exit 1
fi

echo "✅ Docker is installed and running"
echo "   Version: $(docker --version)"
echo ""

# Check if docker compose is available
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose is available"
    echo "   Version: $(docker compose version --short)"
elif command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose (standalone) is available"
    echo "   Version: $(docker-compose --version)"
else
    echo "❌ Docker Compose is not available"
    echo "   Please install Docker Compose or update Docker Desktop"
    exit 1
fi

echo ""
echo "Docker is ready! You can now run:"
echo "  pnpm dev:db    - Start PostgreSQL only"
echo "  pnpm dev:full  - Start PostgreSQL + dev servers"
