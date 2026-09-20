import { missing } from './does-not-exist.js';

export const flag = true;

export function useMissing(): unknown {
  return missing;
}
