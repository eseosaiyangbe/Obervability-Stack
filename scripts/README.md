# 📜 Scripts Directory

This directory contains all the shell scripts for managing the Monitoring in a Box platform. These scripts provide convenient commands for setup, management, and maintenance of the monitoring stack.

## 🚀 Management Scripts

### `devops-monitor.sh`
**Main management script** for the entire monitoring stack.

```bash
# Usage
./scripts/devops-monitor.sh [command]

# Available commands:
./scripts/devops-monitor.sh start     # Start all services
./scripts/devops-monitor.sh stop      # Stop all services
./scripts/devops-monitor.sh restart   # Restart all services
./scripts/devops-monitor.sh status    # Check service status
./scripts/devops-monitor.sh logs      # View service logs
./scripts/devops-monitor.sh ui        # Start UI development server
./scripts/devops-monitor.sh help      # Show help information
./scripts/devops-monitor.sh smoke     # Run the control-plane smoke check
./scripts/devops-monitor.sh operator  # Run the operator-first workflow
./scripts/devops-monitor.sh inventory # Validate monitored app inventory
./scripts/devops-monitor.sh swiftpay  # Audit SwiftPay onboarding contract
./scripts/devops-monitor.sh swiftpay-live # Run the live SwiftPay integration audit
./scripts/devops-monitor.sh memflip  # Audit MemFlip onboarding contract
./scripts/devops-monitor.sh memflip-live # Run the live MemFlip integration audit
./scripts/devops-monitor.sh opensis # Audit OpenSIS onboarding contract
./scripts/devops-monitor.sh opensis-live # Run the live OpenSIS integration audit
./scripts/devops-monitor.sh foodpulse # Audit FoodPulse onboarding contract
./scripts/devops-monitor.sh foodpulse-live # Run the live FoodPulse integration audit
```

**Features:**
- Start/stop/restart the entire monitoring stack
- Check service health and status
- View logs from all services
- Start UI development server
- Comprehensive help system

### `operator-first-check.sh`
**Operator-first workflow** for the shared platform.

```bash
# Usage
./scripts/operator-first-check.sh

# Or through the main wrapper
./scripts/devops-monitor.sh operator
```

**Features:**
- Runs the control-plane smoke check first
- Validates the monitored app inventory contract
- Prints a current workspace app-health snapshot from `/api/apps/health`
- Points the operator to the next app-specific live audit

### `inventory-audit.sh`
**Monitored app inventory validator** for the control plane.

```bash
# Usage
./scripts/inventory-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh inventory
```

**Features:**
- Validates the monitored app model in `ui-next/lib/monitored-apps.ts`
- Checks for duplicate app IDs, priorities, endpoint IDs, and network aliases
- Verifies primary health endpoints, runbook presence, and local repo references
- Confirms endpoint labels and docker targets stay aligned with the inventory contract

### `swiftpay-audit.sh`
**SwiftPay onboarding validator** for the flagship workload.

```bash
# Usage
./scripts/swiftpay-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh swiftpay
```

**Features:**
- Validates SwiftPay observability aliases against the real `SwiftPay/docker-compose.yml`
- Checks control-plane inventory and Prometheus scrape targets for SwiftPay
- Confirms business recording rules, dashboard API queries, and the SwiftPay observability runbook stay aligned

### `swiftpay-live-audit.sh`
**SwiftPay live integration validator** for end-to-end operator confidence.

```bash
# Usage
./scripts/swiftpay-live-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh swiftpay-live
```

**Features:**
- Verifies the live SwiftPay gateway, frontend, Prometheus, and control-plane surfaces are reachable
- Confirms the control plane sees SwiftPay as healthy through `/api/apps/health`
- Creates synthetic users and a real transfer through the public gateway
- Confirms the transfer completes, wallet balance changes, and Prometheus transfer counters react
- Documents that the SwiftPay business endpoint can remain all-zero on a healthy successful path because it tracks pending, failure, queue, and circuit-breaker state

### `memflip-audit.sh`
**MemFlip onboarding validator** for the lightweight demo workload.

```bash
# Usage
./scripts/memflip-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh memflip
```

**Features:**
- Validates MemFlip observability aliases, local ports, and inventory metadata
- Checks the control-plane blackbox targets for MemFlip frontend and backend health
- Confirms the backend exposes `/health`, `/api/health`, and `/metrics`

### `memflip-live-audit.sh`
**MemFlip live integration validator** for end-to-end operator confidence.

```bash
# Usage
./scripts/memflip-live-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh memflip-live
```

**Features:**
- Verifies the live MemFlip frontend, backend, and control-plane health surfaces
- Creates a synthetic user, starts a game, submits a valid match, and completes the game through the frontend proxy
- Confirms the leaderboard and user-stats endpoints respond
- Confirms the backend metrics endpoint records the game flow

### `opensis-audit.sh`
**OpenSIS onboarding validator** for the legacy-platform workload.

```bash
# Usage
./scripts/opensis-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh opensis
```

**Features:**
- Validates OpenSIS observability alias, localhost ports, and control-plane inventory metadata
- Confirms the build-local startup path is documented and wired for Apple Silicon operators
- Checks the control-plane blackbox target and the local Vault-plus-app bootstrap contract

### `opensis-live-audit.sh`
**OpenSIS live integration validator** for end-to-end operator confidence.

```bash
# Usage
./scripts/opensis-live-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh opensis-live
```

**Features:**
- Verifies the live OpenSIS browser path, Vault health surface, and control-plane health view
- Confirms the root page serves recognizable OpenSIS content
- Confirms Prometheus sees the OpenSIS blackbox probe as healthy

### `foodpulse-audit.sh`
**FoodPulse onboarding validator** for the resilience lab workload.

```bash
# Usage
./scripts/foodpulse-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh foodpulse
```

**Features:**
- Validates FoodPulse observability alias, normalized host ports, and workspace-safe container names
- Confirms the control-plane inventory uses the normalized browser URL and startup path
- Checks the control-plane blackbox target and the lab operator helper contract

### `foodpulse-live-audit.sh`
**FoodPulse live integration validator** for end-to-end operator confidence.

```bash
# Usage
./scripts/foodpulse-live-audit.sh

# Or through the main wrapper
./scripts/devops-monitor.sh foodpulse-live
```

**Features:**
- Verifies the live FoodPulse browser path, stats route, and control-plane health view
- Confirms the lab-local Prometheus, Grafana, Alertmanager, and HAProxy stats surfaces are reachable on normalized ports
- Confirms the `cluster-status.sh` operator workflow reports a healthy lab

### `health-check.sh`
**Control-plane smoke check script** for the monitoring stack.

```bash
# Usage
./scripts/health-check.sh

# Or through the main wrapper
./scripts/devops-monitor.sh health
./scripts/devops-monitor.sh smoke
```

**Features:**
- Validates Docker and Compose access
- Checks the default service set from the live Compose config
- Verifies public endpoints like Prometheus, Grafana, Loki, Alertmanager, Node Exporter, and the UI
- Verifies the control-plane API layer through `/api/services/health`, `/api/apps`, and `/api/apps/health`
- Uses cross-platform resource checks that work on macOS and Linux

### `k8s-backup-run.sh`
**One-off Kubernetes control-plane backup runner** for the owned `k3s` path.

```bash
# Usage
./scripts/k8s-backup-run.sh
```

**Features:**
- creates a manual Job from `observability-control-plane-backup`
- waits for backup completion
- prints the backup job logs

### `k8s-backup-inspect.sh`
**Backup artifact inspector** for the control-plane backup PVC.

```bash
# Usage
./scripts/k8s-backup-inspect.sh
```

**Features:**
- mounts `observability-backup-storage`
- lists retained PostgreSQL dump and Alertmanager archive artifacts

### `k8s-restore-run.sh`
**Control-plane restore runner** for the owned `k3s` path.

```bash
# Usage
./scripts/k8s-restore-run.sh

# Restore a specific backup set
./scripts/k8s-restore-run.sh observability-postgres-YYYYMMDDTHHMMSSZ.dump alertmanager-YYYYMMDDTHHMMSSZ.tgz
```

**Features:**
- scales down `grafana`, `devops-monitor-ui`, and `alertmanager`
- restores PostgreSQL-backed control-plane data
- restores Alertmanager persistent state
- scales workloads back up after restore

### `k8s-restore-verify.sh`
**Restore verification runner** for the owned `k3s` path.

```bash
# Usage
./scripts/k8s-restore-verify.sh
```

**Features:**
- confirms the main control-plane workloads are ready again
- verifies PostgreSQL-backed control-plane tables exist
- verifies Alertmanager data files exist on the PVC

### `start.sh`
**Quick start script** for the monitoring stack.

```bash
# Usage
./scripts/start.sh
```

**Features:**
- Starts all monitoring services with Docker Compose
- Checks if services are already running
- Provides status feedback

### `stop.sh`
**Quick stop script** for the monitoring stack.

```bash
# Usage
./scripts/stop.sh
```

**Features:**
- Stops all monitoring services
- Cleans up containers and networks
- Provides confirmation feedback

### `start-ui.sh`
**UI development server** startup script.

```bash
# Usage
./scripts/start-ui.sh
```

**Features:**
- Starts the Next.js development server
- Enables hot reloading for development
- Sets up proper environment variables

## 🛠️ Setup Scripts

### `setup-ui-next.sh`
**UI setup script** for initial configuration.

```bash
# Usage
./scripts/setup-ui-next.sh
```

**Features:**
- Installs Node.js dependencies
- Sets up Prisma database
- Configures environment variables
- Runs database migrations
- Seeds initial data

### `setup-env.sh`
**Environment setup script** for configuration.

```bash
# Usage
./scripts/setup-env.sh
```

**Features:**
- Creates environment files from templates
- Validates configuration
- Sets up development environment
- Configures database connections

### `generate-env.sh`
**Environment generation script** for creating configuration files.

```bash
# Usage
./scripts/generate-env.sh
```

**Features:**
- Interactive environment configuration
- Generates `.env` files from templates
- Validates configuration values
- Creates production-ready configurations

### `start-full-stack.sh`
**Full stack startup script** for complete monitoring stack.

```bash
# Usage
./scripts/start-full-stack.sh
```

**Features:**
- Starts the complete monitoring stack
- Includes all services and dependencies
- Provides comprehensive startup process
- Handles service dependencies

### `test-docker-build.sh`
**Docker build testing script** for validating container builds.

```bash
# Usage
./scripts/test-docker-build.sh
```

**Features:**
- Tests Docker container builds
- Validates image creation
- Checks for build errors
- Provides build status feedback

## 📋 Quick Reference

### Starting the Platform
```bash
# Start everything
./scripts/devops-monitor.sh start

# Or use the quick start
./scripts/start.sh
```

### Development Workflow
```bash
# Setup for first time
./scripts/setup-ui-next.sh
./scripts/setup-env.sh

# Start development
./scripts/start-ui.sh
```

### Stopping Services
```bash
# Stop everything
./scripts/devops-monitor.sh stop

# Or use the quick stop
./scripts/stop.sh
```

### Checking Status
```bash
# Check all services
./scripts/devops-monitor.sh status

# Run the smoke check
./scripts/devops-monitor.sh health

# Validate monitored app inventory
./scripts/devops-monitor.sh inventory

# Audit SwiftPay onboarding contract
./scripts/devops-monitor.sh swiftpay

# Run the live SwiftPay integration audit
./scripts/devops-monitor.sh swiftpay-live

# Audit MemFlip onboarding contract
./scripts/devops-monitor.sh memflip

# Run the live MemFlip integration audit
./scripts/devops-monitor.sh memflip-live

# Audit OpenSIS onboarding contract
./scripts/devops-monitor.sh opensis

# Run the live OpenSIS integration audit
./scripts/devops-monitor.sh opensis-live

# Audit FoodPulse onboarding contract
./scripts/devops-monitor.sh foodpulse

# Run the live FoodPulse integration audit
./scripts/devops-monitor.sh foodpulse-live

# View logs
./scripts/devops-monitor.sh logs
```

## 🔧 Script Features

### Error Handling
- All scripts include comprehensive error handling
- Clear error messages and exit codes
- Validation of prerequisites and dependencies

### Logging
- Consistent logging format across all scripts
- Verbose and quiet modes available
- Log rotation and management

### Cross-Platform Support
- Compatible with Linux, macOS, and WSL
- Handles different shell environments
- Path resolution for different systems

### Safety Features
- Confirmation prompts for destructive operations
- Backup creation before major changes
- Rollback capabilities for failed operations

## 🚨 Troubleshooting

### Common Issues

#### Permission Denied
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

#### Docker Not Running
```bash
# Start Docker service
sudo systemctl start docker

# Or on macOS
open -a Docker
```

#### Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :9090

# Kill processes if needed
sudo kill -9 <PID>
```

#### Environment Issues
```bash
# Regenerate environment
./scripts/generate-env.sh

# Or reset completely
rm .env
./scripts/setup-env.sh
```

### Getting Help
```bash
# Show help for main script
./scripts/devops-monitor.sh help

# Check script syntax
bash -n scripts/devops-monitor.sh

# Run in debug mode
bash -x scripts/devops-monitor.sh start
```

## 📝 Adding New Scripts

When adding new scripts to this directory:

1. **Follow naming convention**: Use descriptive names with `.sh` extension
2. **Add shebang**: Start with `#!/bin/bash`
3. **Include help**: Add `--help` or `-h` option
4. **Error handling**: Include proper error handling and exit codes
5. **Documentation**: Update this README with script description
6. **Permissions**: Make executable with `chmod +x`

### Script Template
```bash
#!/bin/bash

# Script description
# Usage: ./scripts/script-name.sh [options]

set -e  # Exit on error
set -u  # Exit on undefined variable

# Default values
VERBOSE=false
DRY_RUN=false

# Help function
show_help() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help     Show this help"
    echo "  -v, --verbose  Verbose output"
    echo "  -d, --dry-run  Show what would be done"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main script logic here
echo "Script executed successfully"
```

## 🔗 Related Documentation

- **[Setup Guide](../docs/SETUP.md)** - Detailed setup instructions
- **[Configuration Guide](../docs/CONFIGURATION_GUIDE.md)** - Configuration reference
- **[Project Structure](../docs/PROJECT_STRUCTURE.md)** - Complete project overview
- **[Main README](../README.md)** - Project overview

---

**Need help?** Check our [troubleshooting guide](../docs/TROUBLESHOOTING.md) or reach out to our community!
