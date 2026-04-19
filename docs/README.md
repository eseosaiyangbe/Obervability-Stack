# DevOps Monitoring in a Box - Documentation

> Note: use the root `README.md` in this repo as the source of truth for current local startup commands and port mappings. This docs index is a navigation hub and may lag behind runtime changes if it is not refreshed alongside compose updates.

Welcome to the comprehensive documentation for the DevOps Monitoring in a Box project. This documentation covers all aspects of the monitoring system, from setup and configuration to advanced features and integrations.

## 📚 Documentation Index

### 🚀 Getting Started
- **[Setup Guide](SETUP.md)** - Complete setup instructions for the monitoring stack
- **[Configuration Guide](CONFIGURATION_GUIDE.md)** - Complete configuration reference with environment variables
- **[Project Structure](PROJECT_STRUCTURE.md)** - Complete project structure overview
- **[Workspace App Inventory Audit](WORKSPACE_APP_INVENTORY_AUDIT.md)** - Verification of monitored app metadata against the actual workspace
- **[App Onboarding Template](APP_ONBOARDING_TEMPLATE.md)** - Reusable onboarding contract for new or newly normalized workloads
- **[Operator App Matrix](OPERATOR_APP_MATRIX.md)** - Operator-facing summary of the current managed workloads
- **[Operator Health Workflow](OPERATOR_HEALTH_WORKFLOW.md)** - Canonical first-response flow for the platform
- **[Incident Matrix](INCIDENT_MATRIX.md)** - First checks and ownership hints for common incident shapes
- **[SwiftPay Operator Runbook](SWIFTPAY_OPERATOR_RUNBOOK.md)** - Platform-facing runbook for the flagship microservices workload
- **[MemFlip Operator Runbook](MEMFLIP_OPERATOR_RUNBOOK.md)** - Platform-facing runbook for the reference onboarding workload
- **[OpenSIS Operator Runbook](OPENSIS_OPERATOR_RUNBOOK.md)** - Platform-facing runbook for the legacy-platform workload
- **[Main README](../README.md)** - Project overview and quick start guide

### 🔧 Core Components

#### Prometheus Integration
- **[Prometheus Integration Guide](PROMETHEUS_INTEGRATION.md)** - Complete guide to Prometheus setup, configuration, and usage
- **[Alert Rules Configuration](PROMETHEUS_INTEGRATION.md#alert-rules)** - Setting up and managing alert rules

#### Grafana Dashboards
- **[Dashboard Configuration](PROMETHEUS_INTEGRATION.md#grafana-dashboards)** - Creating and customizing monitoring dashboards
- **[Data Source Setup](PROMETHEUS_INTEGRATION.md#data-sources)** - Configuring Prometheus as a data source

#### Loki Log Management
- **[Loki Integration Guide](LOKI_INTEGRATION.md)** - Centralized log aggregation and search
- **[Log Shipping Configuration](LOKI_INTEGRATION.md#log-shipping)** - Setting up Promtail for log collection

#### AlertManager
- **[AlertManager Integration](ALERTMANAGER_INTEGRATION.md)** - Alert routing, grouping, and notification management
- **[Notification Channels](ALERTMANAGER_INTEGRATION.md#notification-channels)** - Email, Slack, and other notification setups

### 🎨 User Interface

#### Next.js Web Application
- **[UI Application Guide](UI_README.md)** - Frontend application setup and features
- **[Auth Access Model](AUTH_ACCESS_MODEL.md)** - Active authentication mode, demo fallback behavior, and operator guidance
- **[Authentication & Multi-Tenancy](AUTHENTICATION_MULTI_TENANCY_GUIDE.md)** - User management and role-based access control

#### Configuration Management
- **[Configuration System Guide](CONFIG_SYSTEM_GUIDE.md)** - Dynamic configuration management
- **[Configuration Enhancement Guide](CONFIGURATION_ENHANCEMENT_GUIDE.md)** - Advanced configuration features

#### Dashboard Templates
- **[Dashboard Template Management Guide](DASHBOARD_TEMPLATE_MANAGEMENT_GUIDE.md)** - Create, import, and manage monitoring dashboard templates
- **[Template Marketplace](DASHBOARD_TEMPLATE_MANAGEMENT_GUIDE.md#template-marketplace)** - Browse and import pre-built templates
- **[Custom Template Creation](DASHBOARD_TEMPLATE_MANAGEMENT_GUIDE.md#creating-custom-templates)** - Build custom templates from scratch

#### Plugin System
- **[Plugin System Guide](PLUGIN_SYSTEM_GUIDE.md)** - Extensible plugin system for new data sources
- **[Available Plugins](PLUGIN_SYSTEM_GUIDE.md#available-plugins)** - AWS CloudWatch, Jenkins, GitHub Actions plugins
- **[Plugin Development](PLUGIN_SYSTEM_GUIDE.md#plugin-development)** - Create custom plugins and integrations

### 🔍 Monitoring & Health

#### Service Health Monitoring
- **[Service Health Guide](SERVICE_HEALTH_GUIDE.md)** - Monitoring service availability and performance
- **[Health Check Endpoints](SERVICE_HEALTH_GUIDE.md#health-endpoints)** - API endpoints for service health

#### User Experience
- **[UX Improvements Guide](UX_IMPROVEMENTS_GUIDE.md)** - User interface enhancements and best practices

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI    │    │   Prometheus    │    │     Grafana     │
│   (Port 4000)   │◄──►│   (Port 9090)   │◄──►│   (Port 3000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   AlertManager  │              │
         │              │   (Port 9093)   │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Loki       │    │  Node Exporter  │    │    Promtail     │
│   (Port 3100)   │    │   (Port 9100)   │    │   (Log Agent)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd devops-monitoring-in-a-box
   ```

2. **Start the monitoring stack**
   ```bash
   ./devops-monitor.sh start
   ```

   Or directly with Docker Compose:

   ```bash
   docker compose up -d
   ```

3. **Access the applications**
   - **Web UI**: http://localhost:4000
   - **Grafana**: http://localhost:3000
   - **Prometheus**: http://localhost:9090
   - **Loki**: http://localhost:3100

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for UI development)
- Basic knowledge of monitoring concepts

## 🔐 Authentication

The system supports multiple authentication methods:
- **Demo Users**: Pre-configured users for testing
- **OAuth Providers**: Google, GitHub integration
- **Role-Based Access**: Admin, Editor, Viewer roles

### Demo Credentials
- **Admin**: `demo@example.com` / `demo123`
- **Editor**: `editor@example.com` / `editor123`
- **Viewer**: `viewer@example.com` / `viewer123`

## 📊 Features

### Core Monitoring
- ✅ **Real-time Metrics**: CPU, Memory, Disk, Network monitoring
- ✅ **Custom Dashboards**: Configurable Grafana dashboards
- ✅ **Alert Management**: Intelligent alerting with AlertManager
- ✅ **Log Aggregation**: Centralized logging with Loki
- ✅ **Service Health**: Automated control-plane smoke checks and status monitoring
- ✅ **Inventory Validation**: Automated monitored-app metadata validation
- ✅ **SwiftPay Audit**: Automated flagship workload onboarding validation
- ✅ **SwiftPay Live Audit**: Automated end-to-end SwiftPay transaction validation against the live control plane
- ✅ **MemFlip Audit**: Automated lightweight workload onboarding validation
- ✅ **MemFlip Live Audit**: Automated end-to-end MemFlip game-flow validation against the live control plane
- ✅ **OpenSIS Audit**: Automated legacy-platform onboarding validation
- ✅ **OpenSIS Live Audit**: Automated OpenSIS browser-and-Vault validation against the live control plane
- ✅ **FoodPulse Audit**: Automated resilience-lab onboarding validation
- ✅ **FoodPulse Live Audit**: Automated FoodPulse browser-and-lab-surface validation against the live control plane

### User Interface
- ✅ **Modern Web UI**: Next.js-based monitoring interface
- ✅ **Responsive Design**: Works on desktop and mobile
- ✅ **Dark/Light Theme**: User preference support
- ✅ **Multi-tenant**: User-specific configurations and dashboards

### Advanced Features
- ✅ **Dynamic Configuration**: Runtime configuration updates
- ✅ **Role-based Access**: Granular permission system
- ✅ **Export/Import**: Configuration backup and restore
- ✅ **API Integration**: RESTful APIs for all components
- ✅ **Plugin System**: Extensible architecture for new data sources
- ✅ **Dashboard Templates**: Pre-built and custom monitoring templates
- ✅ **Template Marketplace**: Community-driven template sharing

## 🛠️ Development

### UI Development
```bash
cd ui-next
npm install
npm run dev
```

### Adding New Metrics
1. Configure in Prometheus
2. Create Grafana dashboard
3. Set up alerts in AlertManager
4. Update UI configuration

### Plugin Development
1. Follow the [Plugin Development Guide](PLUGIN_SYSTEM_GUIDE.md#plugin-development)
2. Implement the Plugin interface
3. Register your plugin in the system
4. Test and validate functionality

### Template Creation
1. Use the [Template Creation Guide](DASHBOARD_TEMPLATE_MANAGEMENT_GUIDE.md#creating-custom-templates)
2. Design your dashboard layout
3. Configure metrics and variables
4. Share via marketplace or GitHub

## 📞 Support

For issues and questions:
1. Check the relevant documentation above
2. Review the setup guide for common issues
3. Check service logs for troubleshooting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

**Built with ❤️ by Harshhaa**

*Last updated: April 2026*
