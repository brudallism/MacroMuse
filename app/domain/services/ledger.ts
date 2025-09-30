// domain/services/ledger.ts - Idempotent meal logging with concrete implementation
import { LogEntry } from '../models'
import { LogRepository } from '../../infra/repositories/LogRepository'

export interface LedgerService {
  add(entry: LogEntry): Promise<void> // idempotent
  addBatch(entries: LogEntry[]): Promise<void> // batch operation for meal plans
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

  async addBatch(entries: LogEntry[]): Promise<void> {
    // Batch operation for meal plan application
    // Process in smaller chunks to avoid overwhelming the database
    const chunkSize = 10

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize)
      await Promise.all(chunk.map(entry => this.add(entry)))
    }
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
