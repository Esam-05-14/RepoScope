import fs from "node:fs";
import remote from "https://example.com/mod.js";
import payload from "data:text/javascript,export default 1";

export const used = fs;
export const also = remote;
export const data = payload;
