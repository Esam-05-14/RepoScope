export function local(): string {
  return "ok";
}

export type LocalType = string;

export const value = require("./missing.cjs");

export async function load(): Promise<unknown> {
  return import("./missing.js");
}

export type Imported = typeof import("./missing.js");
