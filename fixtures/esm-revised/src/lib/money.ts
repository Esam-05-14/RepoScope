import { createApp } from '../main.js';

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function pingEntry(): void {
  createApp();
}
