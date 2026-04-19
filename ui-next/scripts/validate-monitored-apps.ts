import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { monitoredApps } from "../lib/monitored-apps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");

const errors: string[] = [];
const warnings: string[] = [];

function error(message: string) {
  errors.push(message);
}

function warn(message: string) {
  warnings.push(message);
}

function parseCommand(command: string | undefined) {
  if (!command) {
    return null;
  }

  const match = command.match(/^cd\s+([^\s&]+)\s+&&\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    repo: match[1],
    command: match[2],
  };
}

function ensureUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      error(`Duplicate ${label}: ${value}`);
      continue;
    }
    seen.add(value);
  }
}

function extractHostname(target: string) {
  try {
    return new URL(target).hostname;
  } catch {
    return null;
  }
}

const appIds = monitoredApps.map((app) => app.id);
ensureUnique(appIds, "app id");
ensureUnique(monitoredApps.map((app) => String(app.priority)), "priority");

const globalEndpointIds: string[] = [];

for (const app of monitoredApps) {
  if (!app.name.trim()) {
    error(`App ${app.id} is missing a display name`);
  }

  if (app.kubernetes.namespace !== app.id) {
    error(`App ${app.id} namespace mismatch: expected ${app.id}, found ${app.kubernetes.namespace}`);
  }

  if (app.kubernetes.recommendedServiceLabels["observability.dev/app"] !== app.id) {
    error(`App ${app.id} missing observability.dev/app=${app.id} label`);
  }

  if (!app.docker.composeProject?.trim()) {
    warn(`App ${app.id} has no composeProject set`);
  }

  ensureUnique(app.docker.networkAliases, `network alias in ${app.id}`);

  if (app.docker.logLabels.composeProjects.length === 0) {
    error(`App ${app.id} has no composeProjects log labels`);
  }

  if (app.docker.logLabels.services.length === 0) {
    error(`App ${app.id} has no service log labels`);
  }

  if (app.observability.endpoints.length === 0) {
    error(`App ${app.id} has no observability endpoints`);
    continue;
  }

  const endpointIds = app.observability.endpoints.map((endpoint) => endpoint.id);
  ensureUnique(endpointIds, `endpoint id in ${app.id}`);
  globalEndpointIds.push(...endpointIds);

  const primaryEndpoint = app.observability.endpoints.find(
    (endpoint) => endpoint.id === app.observability.primaryHealthEndpointId
  );
  if (!primaryEndpoint) {
    error(`App ${app.id} primaryHealthEndpointId does not match any endpoint`);
  }

  if (!app.observability.logQuery.trim()) {
    error(`App ${app.id} is missing a log query`);
  }

  if (!app.observability.uptimeQuery.trim()) {
    error(`App ${app.id} is missing an uptime query`);
  }

  if (!app.observability.latencyQuery.trim()) {
    error(`App ${app.id} is missing a latency query`);
  }

  if (app.status === "active") {
    if (!app.runbooks.localStart?.trim()) {
      error(`Active app ${app.id} is missing a localStart runbook`);
    }

    if (!app.runbooks.healthCheck?.trim()) {
      error(`Active app ${app.id} is missing a healthCheck runbook`);
    }
  }

  const startCommand = parseCommand(app.runbooks.localStart);
  if (startCommand) {
    const repoPath = path.join(workspaceRoot, startCommand.repo);
    if (!fs.existsSync(repoPath)) {
      error(`App ${app.id} localStart repo does not exist: ${startCommand.repo}`);
    } else if (startCommand.command.startsWith("./")) {
      const commandPath = path.join(repoPath, startCommand.command.split(/\s+/)[0]);
      if (!fs.existsSync(commandPath)) {
        error(`App ${app.id} localStart helper does not exist: ${startCommand.command}`);
      }
    }
  } else if (app.runbooks.localStart) {
    warn(`App ${app.id} localStart does not follow 'cd <repo> && <command>' format`);
  }

  const browserEndpoints = app.observability.endpoints.filter((endpoint) => Boolean(endpoint.browserUrl));
  if (browserEndpoints.length === 0) {
    warn(`App ${app.id} has no browserUrl on any endpoint`);
  }

  for (const endpoint of app.observability.endpoints) {
    if (!endpoint.name.trim()) {
      error(`Endpoint ${endpoint.id} in ${app.id} is missing a display name`);
    }

    if (endpoint.prometheusLabels.app !== app.id) {
      error(`Endpoint ${endpoint.id} in ${app.id} has prometheusLabels.app=${endpoint.prometheusLabels.app}`);
    }

    if (endpoint.prometheusLabels.target !== endpoint.dockerTarget) {
      error(`Endpoint ${endpoint.id} in ${app.id} has mismatched prometheus target`);
    }

    if (!endpoint.kubernetes?.serviceName?.trim()) {
      error(`Endpoint ${endpoint.id} in ${app.id} is missing kubernetes.serviceName`);
    }

    if (endpoint.kubernetes?.namespace !== app.kubernetes.namespace) {
      error(`Endpoint ${endpoint.id} in ${app.id} namespace mismatch`);
    }

    const dockerHost = extractHostname(endpoint.dockerTarget);
    if (!dockerHost) {
      error(`Endpoint ${endpoint.id} in ${app.id} has an invalid dockerTarget: ${endpoint.dockerTarget}`);
    } else if (!app.docker.networkAliases.includes(dockerHost)) {
      error(`Endpoint ${endpoint.id} in ${app.id} uses docker host ${dockerHost} not present in networkAliases`);
    }

    if (endpoint.kind === "frontend" && !endpoint.browserUrl) {
      warn(`Frontend endpoint ${endpoint.id} in ${app.id} has no browserUrl`);
    }

    if (endpoint.browserUrl) {
      const browserHost = extractHostname(endpoint.browserUrl);
      if (!browserHost) {
        error(`Endpoint ${endpoint.id} in ${app.id} has invalid browserUrl: ${endpoint.browserUrl}`);
      } else if (!["localhost", "127.0.0.1"].includes(browserHost)) {
        warn(`Endpoint ${endpoint.id} in ${app.id} uses a non-local browser host: ${browserHost}`);
      }
    }
  }
}

ensureUnique(globalEndpointIds, "global endpoint id");

console.log("Monitored app inventory validation");
console.log("==================================");
console.log(`Apps checked: ${monitoredApps.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length > 0) {
  console.log("");
  console.log("Warnings");
  console.log("--------");
  for (const message of warnings) {
    console.log(`- ${message}`);
  }
}

if (errors.length > 0) {
  console.log("");
  console.log("Errors");
  console.log("------");
  for (const message of errors) {
    console.log(`- ${message}`);
  }
  process.exit(1);
}

console.log("");
console.log("Inventory validation passed.");
