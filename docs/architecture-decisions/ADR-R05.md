# ADR-R05: No LLM in the trust path

**Status:** Accepted (R0)

Parsing, resolution, graph analysis, snapshot comparison, and evidence rendering are ordinary software. No model, API key, embeddings, or vector database.

A later explanation assistant, if ever added, must be separately labeled, disabled by default, require consent before any source leaves the machine, and must never create authoritative graph edges.
