export type AppOwnership = 'owned' | 'cloned-public-repo';

export type MonitoredAppStatus = 'active' | 'planned';

export interface MonitoredEndpoint {
  id: string;
  name: string;
  kind: 'frontend' | 'api' | 'service';
  dockerTarget: string;
  browserUrl?: string;
  prometheusLabels: {
    job: string;
    app: string;
    component: string;
    target: string;
  };
  kubernetes?: {
    serviceName: string;
    namespace: string;
    portName?: string;
    path: string;
  };
}

export interface MonitoredApp {
  id: string;
  name: string;
  description: string;
  ownership: AppOwnership;
  status: MonitoredAppStatus;
  priority: number;
  environment: 'local' | 'hybrid';
  category: string;
  docker: {
    composeProject?: string;
    networkAliases: string[];
    logLabels: {
      composeProjects: string[];
      containers: string[];
      services: string[];
    };
  };
  kubernetes: {
    namespace: string;
    recommendedServiceLabels: Record<string, string>;
  };
  observability: {
    endpoints: MonitoredEndpoint[];
    primaryHealthEndpointId: string;
    logQuery: string;
    uptimeQuery: string;
    latencyQuery: string;
  };
  runbooks: {
    localStart?: string;
    kubernetesDeploy?: string;
    kubernetesVerify?: string;
    healthCheck?: string;
  };
  tags: string[];
}

export const monitoredApps: MonitoredApp[] = [
  {
    id: 'opensis',
    name: 'OpenSIS',
    description: 'Student information system and the first app we will fully manage.',
    ownership: 'owned',
    status: 'active',
    priority: 1,
    environment: 'local',
    category: 'student-information-system',
    docker: {
      composeProject: 'opensis',
      networkAliases: ['opensis-ui'],
      logLabels: {
        composeProjects: ['opensis'],
        containers: ['opensis-ui'],
        services: ['opensis-ui'],
      },
    },
    kubernetes: {
      namespace: 'opensis',
      recommendedServiceLabels: {
        'app.kubernetes.io/name': 'opensis',
        'app.kubernetes.io/part-of': 'student-information-system',
        'observability.dev/app': 'opensis',
      },
    },
    observability: {
      endpoints: [
        {
          id: 'opensis-ui',
          name: 'OpenSIS UI',
          kind: 'frontend',
          dockerTarget: 'http://opensis-ui/',
          browserUrl: 'http://localhost:8088',
          prometheusLabels: {
            job: 'blackbox-http',
            app: 'opensis',
            component: 'frontend',
            target: 'http://opensis-ui/',
          },
          kubernetes: {
            serviceName: 'opensis-ui',
            namespace: 'opensis',
            portName: 'http',
            path: '/',
          },
        },
      ],
      primaryHealthEndpointId: 'opensis-ui',
      logQuery: '{compose_project=~".*opensis.*"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="opensis"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="opensis"}',
    },
    runbooks: {
      localStart: 'cd OpenSIS && ./scripts/compose-start.sh',
      healthCheck: 'curl -I http://localhost:8088',
    },
    tags: ['first-managed-app', 'php', 'mariadb'],
  },
  {
    id: 'swiftpay',
    name: 'SwiftPay',
    description: 'Wallet/payment microservices app that now serves as the second real k3s migration slice.',
    ownership: 'cloned-public-repo',
    status: 'active',
    priority: 2,
    environment: 'hybrid',
    category: 'wallet-platform',
    docker: {
      composeProject: 'swiftpay',
      networkAliases: [
        'swiftpay-frontend',
        'swiftpay-api-gateway',
        'swiftpay-auth-service',
        'swiftpay-wallet-service',
        'swiftpay-transaction-service',
        'swiftpay-notification-service',
      ],
      logLabels: {
        composeProjects: ['swiftpay'],
        containers: [
          'swiftpay-frontend',
          'swiftpay-api-gateway',
          'swiftpay-auth-service',
          'swiftpay-wallet-service',
          'swiftpay-transaction-service',
          'swiftpay-notification-service',
        ],
        services: [
          'frontend',
          'api-gateway',
          'auth-service',
          'wallet-service',
          'transaction-service',
          'notification-service',
        ],
      },
    },
    kubernetes: {
      namespace: 'swiftpay-dev',
      recommendedServiceLabels: {
        'app.kubernetes.io/name': 'swiftpay',
        'app.kubernetes.io/part-of': 'wallet-platform',
        'observability.dev/app': 'swiftpay',
      },
    },
    observability: {
      endpoints: [
        endpoint('swiftpay-frontend', 'SwiftPay Frontend', 'frontend', 'http://swiftpay-frontend/', 'http://localhost:8081', 'swiftpay', 'frontend', '/', 'swiftpay-dev'),
        endpoint('swiftpay-api-gateway', 'SwiftPay API Gateway', 'api', 'http://swiftpay-api-gateway:3000/health', 'http://localhost:3007/health', 'swiftpay', 'api-gateway', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-auth-service', 'SwiftPay Auth Service', 'service', 'http://swiftpay-auth-service:3004/health', undefined, 'swiftpay', 'auth-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-wallet-service', 'SwiftPay Wallet Service', 'service', 'http://swiftpay-wallet-service:3001/health', undefined, 'swiftpay', 'wallet-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-transaction-service', 'SwiftPay Transaction Service', 'service', 'http://swiftpay-transaction-service:3002/health', undefined, 'swiftpay', 'transaction-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-notification-service', 'SwiftPay Notification Service', 'service', 'http://swiftpay-notification-service:3003/health', undefined, 'swiftpay', 'notification-service', '/health', 'swiftpay-dev'),
      ],
      primaryHealthEndpointId: 'swiftpay-frontend',
      logQuery: '{compose_project=~".*swiftpay.*"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="swiftpay"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="swiftpay"}',
    },
    runbooks: {
      localStart: 'cd SwiftPay && docker compose up -d',
      kubernetesDeploy: 'cd SwiftPay && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd SwiftPay && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -fsS http://localhost:3007/health && curl -I http://localhost:8081',
    },
    tags: ['microservices', 'nodejs', 'payments', 'k3s-second-slice'],
  },
  {
    id: 'memflip',
    name: 'MemFlip',
    description: 'Frontend/backend onboarding app that now doubles as the first real k3s migration template.',
    ownership: 'cloned-public-repo',
    status: 'active',
    priority: 3,
    environment: 'hybrid',
    category: 'demo-app',
    docker: {
      composeProject: 'memflip',
      networkAliases: ['memflip-frontend', 'memflip-backend'],
      logLabels: {
        composeProjects: ['memflip'],
        containers: ['memflip-frontend', 'memflip-backend'],
        services: ['frontend', 'backend'],
      },
    },
    kubernetes: {
      namespace: 'memflip-dev',
      recommendedServiceLabels: {
        'app.kubernetes.io/name': 'memflip',
        'app.kubernetes.io/part-of': 'demo-app',
        'observability.dev/app': 'memflip',
      },
    },
    observability: {
      endpoints: [
        endpoint('memflip-frontend', 'MemFlip Frontend', 'frontend', 'http://memflip-frontend/api/health', 'http://localhost:8080', 'memflip', 'frontend', '/api/health', 'memflip-dev'),
        endpoint('memflip-backend', 'MemFlip Backend', 'api', 'http://memflip-backend:3001/health', undefined, 'memflip', 'backend', '/health', 'memflip-dev'),
      ],
      primaryHealthEndpointId: 'memflip-frontend',
      logQuery: '{compose_project=~".*memflip.*"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="memflip"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="memflip"}',
    },
    runbooks: {
      localStart: 'cd MemFlip && docker compose up -d',
      kubernetesDeploy: 'cd MemFlip && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd MemFlip && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -fsS http://localhost:8080/api/health',
    },
    tags: ['frontend', 'backend', 'k3s-first-slice'],
  },
  {
    id: 'foodpulse',
    name: 'FoodPulse',
    description: 'Resilience lab app that now carries an owned k3s slice with CloudNativePG and Sentinel-aware Redis failover.',
    ownership: 'cloned-public-repo',
    status: 'active',
    priority: 4,
    environment: 'hybrid',
    category: 'resilience-lab',
    docker: {
      composeProject: 'foodpulse',
      networkAliases: ['foodpulse-ui', 'foodpulse-api'],
      logLabels: {
        composeProjects: ['foodpulse'],
        containers: ['foodpulse-ui', 'foodpulse-api'],
        services: ['foodpulse-ui', 'foodpulse-api'],
      },
    },
    kubernetes: {
      namespace: 'foodpulse-dev',
      recommendedServiceLabels: {
        'app.kubernetes.io/name': 'foodpulse',
        'app.kubernetes.io/part-of': 'resilience-lab',
        'observability.dev/app': 'foodpulse',
      },
    },
    observability: {
      endpoints: [
        endpoint('foodpulse-ui', 'FoodPulse UI', 'frontend', 'http://foodpulse-ui/', 'http://localhost:8090', 'foodpulse', 'frontend', '/', 'foodpulse-dev'),
        endpoint('foodpulse-api', 'FoodPulse API', 'api', 'http://foodpulse-api:4567/health', undefined, 'foodpulse', 'api', '/health', 'foodpulse-dev'),
      ],
      primaryHealthEndpointId: 'foodpulse-ui',
      logQuery: '{compose_project=~".*foodpulse.*"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="foodpulse"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="foodpulse"}',
    },
    runbooks: {
      localStart: 'cd FoodPulse && cp .env.example .env && ./scripts/start.sh',
      kubernetesDeploy: 'cd FoodPulse && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd FoodPulse && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -I http://localhost:8090',
    },
    tags: ['frontend', 'redis-sentinel', 'cnpg', 'k3s-third-slice'],
  },
];

export function getMonitoredApp(appId: string): MonitoredApp | undefined {
  return monitoredApps.find((app) => app.id === appId);
}

function endpoint(
  id: string,
  name: string,
  kind: MonitoredEndpoint['kind'],
  dockerTarget: string,
  browserUrl: string | undefined,
  app: string,
  component: string,
  path = '/',
  namespace = app
): MonitoredEndpoint {
  return {
    id,
    name,
    kind,
    dockerTarget,
    browserUrl,
    prometheusLabels: {
      job: 'blackbox-http',
      app,
      component,
      target: dockerTarget,
    },
    kubernetes: {
      serviceName: id,
      namespace,
      portName: 'http',
      path,
    },
  };
}
