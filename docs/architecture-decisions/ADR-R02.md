# ADR-R02: Local Node plus browser UI

**Status:** Accepted (R0)

A loopback Fastify service serves a prebuilt React UI. This avoids Electron packaging while keeping local filesystem access.

Tradeoff: a local HTTP security boundary that must be tested (Host/Origin, session token, loopback bind). See `SECURITY.md`.
