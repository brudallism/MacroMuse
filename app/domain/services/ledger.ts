// domain/services/ledger.ts
import { LogEntry } from '@domain/models'

export interface LedgerService {
  add(_entry: LogEntry): Promise<void> // idempotent
  remove(_id: string): Promise<void>
}
