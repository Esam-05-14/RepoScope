import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./errors.js";
import { allowedHost, allowedOrigin, type Session } from "./session.js";

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

const PUBLIC_GET_PATHS = new Set([
  "/",
  "/index.html",
  "/explore",
  "/coverage",
  "/compare",
  "/settings",
  "/boundaries",
  "/brief",
  "/favicon.ico",
]);

function readBearer(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const match = /^Bearer[ ]+(\S+)$/u.exec(header);
  return match?.[1] ?? null;
}

function hostAllowed(session: Session, hostHeader: string | undefined): boolean {
  const expected = allowedHost(session);
  if (expected === null || hostHeader === undefined) {
    return false;
  }
  return hostHeader === expected;
}

function originAllowed(session: Session, origin: string | undefined): boolean {
  if (origin === undefined || origin === "") {
    return true;
  }
  return origin === allowedOrigin(session);
}

export function registerSecurity(app: FastifyInstance, session: Session): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Content-Security-Policy", CSP);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");

    if (!hostAllowed(session, request.headers.host)) {
      sendError(
        reply,
        403,
        "INVALID_HOST",
        "Host header is not the loopback address for this session.",
      );
      return reply;
    }

    if (!originAllowed(session, request.headers.origin)) {
      sendError(
        reply,
        403,
        "FORBIDDEN_ORIGIN",
        "Origin is not allowed for this local session.",
      );
      return reply;
    }

    const url = request.url.split("?")[0] ?? request.url;
    const isPublicAsset =
      (request.method === "GET" || request.method === "HEAD") &&
      (PUBLIC_GET_PATHS.has(url) || url.startsWith("/assets/"));

    if (isPublicAsset) {
      return;
    }

    const token = readBearer(request.headers.authorization);
    if (token === null || token !== session.token) {
      sendError(
        reply,
        401,
        "UNAUTHENTICATED",
        "A valid session token is required.",
      );
      return reply;
    }
  });
}
