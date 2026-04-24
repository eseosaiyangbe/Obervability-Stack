#!/bin/bash

# DevOps Monitoring in a Box - Startup Script
# This script starts the monitoring stack and provides status information

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root directory (parent of scripts directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT"

echo "🚀 Starting DevOps Monitoring in a Box..."
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose first."
    exit 1
fi

# Start the services
echo "📦 Starting monitoring services..."
docker compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
docker compose ps

echo ""
echo "✅ Monitoring stack is starting up!"
echo ""
echo "🌐 Access your monitoring tools:"
echo "   DevOps Monitor UI: http://localhost:4000"
echo "   Grafana:            http://localhost:3000 (admin/admin)"
echo "   Prometheus:         http://localhost:9090"
echo "   Loki:               http://localhost:3100"
echo "   Alertmanager:       http://localhost:9093"
echo "   cAdvisor:           http://localhost:8080"
echo ""
echo "📊 The Node Exporter dashboard will be available in Grafana"
echo "📝 Check logs with: docker compose logs -f [service-name]"
echo "🛑 Stop services with: docker compose down"
echo ""
echo "Happy monitoring! 🚀"
