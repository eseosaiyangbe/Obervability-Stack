import https from "https";
import fs from "fs";

type KubernetesPodListResponse = {
  metadata?: {
    continue?: string;
  };
  items?: Array<unknown>;
};

const SERVICE_ACCOUNT_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const SERVICE_ACCOUNT_CA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

function isInCluster() {
  return Boolean(process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT);
}

function getClusterRequestOptions(path: string): https.RequestOptions {
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT || "443";

  if (!host) {
    throw new Error("Kubernetes service host is not available");
  }

  const token = fs.readFileSync(SERVICE_ACCOUNT_TOKEN_PATH, "utf8").trim();
  const ca = fs.readFileSync(SERVICE_ACCOUNT_CA_PATH);

  return {
    host,
    port: Number(port),
    path,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    ca,
  };
}

function clusterGet<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(getClusterRequestOptions(path), (response) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Kubernetes API request failed with ${response.statusCode}: ${body}`));
          return;
        }

        try {
          resolve(JSON.parse(body) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
    request.end();
  });
}

export class KubernetesAPI {
  async getRunningPodCount(): Promise<number | null> {
    if (!isInCluster()) {
      return null;
    }

    let count = 0;
    let continueToken: string | undefined;

    do {
      const params = new URLSearchParams({
        fieldSelector: "status.phase=Running",
        limit: "500",
      });

      if (continueToken) {
        params.set("continue", continueToken);
      }

      const response = await clusterGet<KubernetesPodListResponse>(`/api/v1/pods?${params.toString()}`);
      count += response.items?.length || 0;
      continueToken = response.metadata?.continue;
    } while (continueToken);

    return count;
  }
}

export const kubernetesAPI = new KubernetesAPI();
