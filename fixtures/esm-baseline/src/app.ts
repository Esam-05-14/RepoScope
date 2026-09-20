import { formatCents } from './lib/money.js';
import { startCycle } from './cycle-a.js';

export function createApp(): void {
  formatCents(199);
  startCycle();
}

export function loop(): string {
  return 'cycle';
}
