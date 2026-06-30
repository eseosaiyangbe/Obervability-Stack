# Cloud CI/CD: Dev-First Runtime, Docker Hub Publish, Manual Prod

This repository now follows a dev-first CI/CD contract.

The active runtime truth is the public `dev` control plane:

- host: `https://portfolio.eseosadevbox.com`
- namespace: `platform-observability-dev`
- Argo CD application: `observability-dev`

The workflow lanes are intentionally separated:

1. `.github/workflows/validate.yml`
   - validates repository integrity and application build health
   - does not publish images
   - does not mutate any cluster

2. `.github/workflows/publish-dockerhub-image.yml`
   - publishes the `ui-next` image to Docker Hub
   - provides the registry artifact used by the owned deployment path
   - does not claim that image publication alone is deployment

3. `.github/workflows/smoke-dev-public.yml`
   - probes the active public `dev` edge
   - checks `/` and `/api/health`
   - provides evidence that users can reach the live control plane

## Production posture

`prod` remains a held contract, not the active runtime narrative.

That means:

- `platform-observability-prod` exists as deployment contract material
- automated reconciliation is intentionally disabled in the local Argo CD prod application manifest
- any future production promotion should be explicit, reviewed, and manually approved

This is the correct posture for the current environment. It is better to state that `dev` is the live truth than to present a false impression of continuous production deployment.
