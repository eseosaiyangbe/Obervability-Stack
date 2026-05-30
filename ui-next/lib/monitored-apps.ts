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
    description: 'Student information platform with Vault-backed Kubernetes operations and a production-minded dev environment.',
    ownership: 'owned',
    status: 'active',
    priority: 1,
    environment: 'hybrid',
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
      namespace: 'opensis-dev',
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
          dockerTarget: 'https://opensis.eseosadevbox.com/install/index.php',
          browserUrl: 'https://opensis.eseosadevbox.com',
          prometheusLabels: {
            job: 'blackbox-http',
            app: 'opensis',
            component: 'frontend',
            target: 'https://opensis.eseosadevbox.com/install/index.php',
          },
          kubernetes: {
            serviceName: 'opensis-ui',
            namespace: 'opensis-dev',
            portName: 'http',
            path: '/',
          },
        },
      ],
      primaryHealthEndpointId: 'opensis-ui',
      logQuery: '{namespace=~"opensis-dev|opensis-prod"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="opensis"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="opensis"}',
    },
    runbooks: {
      localStart: 'cd ../opensis && ./scripts/compose-start.sh',
      kubernetesDeploy: 'cd ../opensis && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd ../opensis && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -I http://localhost:8088',
    },
    tags: ['first-managed-app', 'php', 'mariadb', 'k3s-vault-first-slice'],
  },
  {
    id: 'swiftpay',
    name: 'SwiftPay',
    description: 'Payment microservices platform with gateway, wallet, transaction, and notification services operated on Kubernetes.',
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
        endpoint('swiftpay-frontend', 'SwiftPay Frontend', 'frontend', 'http://swiftpay-frontend/', 'https://swiftpay.eseosadevbox.com', 'swiftpay', 'frontend', '/', 'swiftpay-dev'),
        endpoint('swiftpay-api-gateway', 'SwiftPay API Gateway', 'api', 'http://swiftpay-api-gateway:3000/health', 'https://swiftpay-api.eseosadevbox.com/health', 'swiftpay', 'api-gateway', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-auth-service', 'SwiftPay Auth Service', 'service', 'http://swiftpay-auth-service:3004/health', undefined, 'swiftpay', 'auth-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-wallet-service', 'SwiftPay Wallet Service', 'service', 'http://swiftpay-wallet-service:3001/health', undefined, 'swiftpay', 'wallet-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-transaction-service', 'SwiftPay Transaction Service', 'service', 'http://swiftpay-transaction-service:3002/health', undefined, 'swiftpay', 'transaction-service', '/health', 'swiftpay-dev'),
        endpoint('swiftpay-notification-service', 'SwiftPay Notification Service', 'service', 'http://swiftpay-notification-service:3003/health', undefined, 'swiftpay', 'notification-service', '/health', 'swiftpay-dev'),
      ],
      primaryHealthEndpointId: 'swiftpay-frontend',
      logQuery: '{namespace=~"swiftpay-dev|swiftpay-prod"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="swiftpay"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="swiftpay"}',
    },
    runbooks: {
      localStart: 'cd ../swiftpay && docker compose up -d',
      kubernetesDeploy: 'cd ../swiftpay && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd ../swiftpay && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -fsS http://localhost:3007/health && curl -I http://localhost:8081',
    },
    tags: ['microservices', 'nodejs', 'payments', 'k3s-second-slice'],
  },
  {
    id: 'memflip',
    name: 'MemFlip',
    description: 'Internet-facing reference application for frontend and backend delivery, ingress validation, and reusable Kubernetes deployment patterns.',
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
        endpoint('memflip-frontend', 'MemFlip Frontend', 'frontend', 'https://memflip.eseosadevbox.com/api/health', 'https://memflip.eseosadevbox.com', 'memflip', 'frontend', '/api/health', 'memflip-dev'),
        endpoint('memflip-backend', 'MemFlip Backend', 'api', 'https://memflip.eseosadevbox.com/api/health', undefined, 'memflip', 'backend', '/health', 'memflip-dev'),
      ],
      primaryHealthEndpointId: 'memflip-frontend',
      logQuery: '{namespace=~"memflip-dev|memflip-prod"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="memflip"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="memflip"}',
    },
    runbooks: {
      localStart: 'cd ../memflip && docker compose up -d',
      kubernetesDeploy: 'cd ../memflip && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd ../memflip && ./scripts/k8s-dev-verify.sh',
      healthCheck: 'curl -fsS http://localhost:8080/api/health',
    },
    tags: ['frontend', 'backend', 'k3s-first-slice'],
  },
  {
    id: 'foodpulse',
    name: 'FoodPulse',
    description: 'Consumer-facing application with a resilience-focused Kubernetes model built on CloudNativePG and Sentinel-backed Redis failover.',
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
        endpoint('foodpulse-ui', 'FoodPulse UI', 'frontend', 'https://foodpulse.eseosadevbox.com/', 'https://foodpulse.eseosadevbox.com', 'foodpulse', 'frontend', '/', 'foodpulse-dev'),
        endpoint('foodpulse-api', 'FoodPulse API', 'api', 'http://foodpulse-api.foodpulse-dev.svc.cluster.local:4567/health', undefined, 'foodpulse', 'api', '/health', 'foodpulse-dev'),
      ],
      primaryHealthEndpointId: 'foodpulse-ui',
      logQuery: '{namespace=~"foodpulse-dev|foodpulse-prod"}',
      uptimeQuery: 'probe_success{job="blackbox-http",app="foodpulse"}',
      latencyQuery: 'probe_duration_seconds{job="blackbox-http",app="foodpulse"}',
    },
    runbooks: {
      localStart: 'cd ../foodpulse && cp .env.example .env && ./scripts/start.sh',
      kubernetesDeploy: 'cd ../foodpulse && ./scripts/k8s-dev-deploy.sh',
      kubernetesVerify: 'cd ../foodpulse && ./scripts/k8s-dev-verify.sh',
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
