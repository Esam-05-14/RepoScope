import type { FastifyReply } from "fastify";
import type { ApiError, ApiErrorCode } from "@reposcope/contracts";
import { createDiagnosticId } from "./session.js";

export function sendError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
): void {
  const body: ApiError = {
    code,
    message,
    diagnosticId: createDiagnosticId(),
  };
  void reply.status(status).send(body);
}
