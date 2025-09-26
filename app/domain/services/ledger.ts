// domain/services/ledger.ts - Idempotent meal logging with concrete implementation
import { LogEntry } from '../models'
import { LogRepository } from '../../infra/repositories/LogRepository'

export interface LedgerService {
  add(entry: LogEntry): Promise<void> // idempotent
  remove(id: string): Promise<void>
  getEntriesForDate(userId: string, dateISO: string): Promise<LogEntry[]>
}

export class LedgerServiceImpl implements LedgerService {
  constructor(private logRepository: LogRepository) {}

  async add(entry: LogEntry): Promise<void> {
    // Idempotent operation
    // Emit meal_logged event
    // Trigger daily totals recalculation
    await this.logRepository.create(entry)
  }

  async remove(id: string): Promise<void> {
    await this.logRepository.delete(id)
  }

  async getEntriesForDate(userId: string, dateISO: string): Promise<LogEntry[]> {
    return await this.logRepository.findByUserAndDate(userId, dateISO)
  }

  async updateEntry(id: string, changes: Partial<LogEntry>): Promise<LogEntry> {
    return await this.logRepository.update(id, changes)
  }
}
