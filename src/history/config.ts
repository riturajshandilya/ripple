import { join } from 'node:path';
export const historyPath = () => join(process.cwd(), 'data', 'history.sqlite');
export function retentionDays(): number {
  const days = Number(process.env.HISTORY_RETENTION_DAYS ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 3650)
    throw new Error('HISTORY_RETENTION_DAYS must be an integer between 1 and 3650');
  return days;
}
