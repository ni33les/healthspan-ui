import { createHash, timingSafeEqual } from "node:crypto";

const noStoreHeaders = {
  "Cache-Control": "no-store"
} as const;

const unauthorizedHeaders = {
  ...noStoreHeaders,
  "WWW-Authenticate": 'Bearer realm="mattanutra-worker-api"'
} as const;

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function configuredWorkerToken() {
  return process.env.WORKER_API_TOKEN?.trim() || "";
}

function bearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";

  return authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
}

function tokenMatches(supplied: string, configuredToken: string) {
  const trimmed = supplied.trim();

  if (!configuredToken || !trimmed) {
    return false;
  }

  return timingSafeEqual(hash(trimmed), hash(configuredToken));
}

export function workerApiTokenConfigured() {
  return Boolean(configuredWorkerToken());
}

export function workerApiTokenAllowed(token: unknown) {
  return typeof token === "string" && tokenMatches(token, configuredWorkerToken());
}

export function workerRequestAllowed(request: Request) {
  return (
    workerApiTokenAllowed(bearerToken(request)) ||
    workerApiTokenAllowed(request.headers.get("x-worker-api-token"))
  );
}

export function workerUnauthorized() {
  return Response.json(
    { message: "Worker API access is not authorized" },
    {
      headers: unauthorizedHeaders,
      status: 401
    }
  );
}

export function requireWorkerRequest(request: Request) {
  return workerRequestAllowed(request) ? null : workerUnauthorized();
}
