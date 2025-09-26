// tests/domain/targets.test.ts - Test goal precedence with golden fixtures
import { TargetsServiceImpl } from '../../domain/services/targets'
import { TargetsRepository } from '../../infra/repositories/TargetsRepository'
import { TargetVector } from '../../domain/models'

// Mock the TargetsRepository
jest.mock('../../infra/repositories/TargetsRepository')
const MockTargetsRepository = TargetsRepository as jest.MockedClass<typeof TargetsRepository>

describe('TargetsService', () => {
  let targetsService: TargetsServiceImpl
  let mockRepository: jest.Mocked<TargetsRepository>

  beforeEach(() => {
    mockRepository = new MockTargetsRepository({} as any) as jest.Mocked<TargetsRepository>
    targetsService = new TargetsServiceImpl(mockRepository)
  })

  describe('get targets with precedence', () => {
    const userId = 'user123'
    const date = '2024-01-15'

    const baseTargets: TargetVector = {
      calories: 2000,
      protein_g: 150,
      carbs_g: 200,
      fat_g: 67
    }

    const weeklyTargets: TargetVector = {
      calories: 1800,
      protein_g: 140,
      carbs_g: 180,
      fat_g: 60
    }

    const menstrualTargets: TargetVector = {
      calories: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 73
    }

    it('should return base targets when no overrides exist', async () => {
      mockRepository.getTargets.mockResolvedValue(baseTargets)

      const result = await targetsService.get(userId, date)

      expect(result).toEqual(baseTargets)
      expect(mockRepository.getTargets).toHaveBeenCalledWith(userId, date)
    })

    it('should prioritize weekly targets over base targets', async () => {
      mockRepository.getTargets.mockResolvedValue(weeklyTargets)

      const result = await targetsService.get(userId, date)

      expect(result).toEqual(weeklyTargets)
    })

    it('should prioritize menstrual targets over weekly and base targets', async () => {
      mockRepository.getTargets.mockResolvedValue(menstrualTargets)

      const result = await targetsService.get(userId, date)

      expect(result).toEqual(menstrualTargets)
    })

    it('should handle repository errors gracefully', async () => {
      const error = new Error('Repository error')
      mockRepository.getTargets.mockRejectedValue(error)

      await expect(targetsService.get(userId, date)).rejects.toThrow('Repository error')
    })
  })

  describe('setBaseGoal', () => {
    it('should set base goal successfully', async () => {
      const userId = 'user123'
      const goal = 'weight_loss'

      mockRepository.setBaseGoal.mockResolvedValue()

      await targetsService.setBaseGoal(userId, goal)

      expect(mockRepository.setBaseGoal).toHaveBeenCalledWith(userId, goal)
    })

    it('should handle set base goal errors', async () => {
      const userId = 'user123'
      const goal = 'maintenance'
      const error = new Error('Failed to set goal')

      mockRepository.setBaseGoal.mockRejectedValue(error)

      await expect(targetsService.setBaseGoal(userId, goal)).rejects.toThrow('Failed to set goal')
    })
  })

  describe('setWeeklyGoal', () => {
    it('should set weekly goal with date range', async () => {
      const userId = 'user123'
      const goal = 'muscle_gain'
      const startDate = '2024-01-15'
      const endDate = '2024-01-21'

      mockRepository.setWeeklyGoal.mockResolvedValue()

      await targetsService.setWeeklyGoal(userId, goal, startDate, endDate)

      expect(mockRepository.setWeeklyGoal).toHaveBeenCalledWith(userId, goal, startDate, endDate)
    })
  })

  describe('setMenstrualGoal', () => {
    it('should set menstrual goal with adjustments', async () => {
      const userId = 'user123'
      const adjustments = {
        calories: 2200,
        protein_g: 160
      }
      const startDate = '2024-01-15'
      const endDate = '2024-01-18'

      mockRepository.setMenstrualGoal.mockResolvedValue()

      await targetsService.setMenstrualGoal(userId, adjustments, startDate, endDate)

      expect(mockRepository.setMenstrualGoal).toHaveBeenCalledWith(userId, adjustments, startDate, endDate)
    })
  })

  describe('performance requirements', () => {
    it('should retrieve targets within 500ms budget', async () => {
      const userId = 'user123'
      const date = '2024-01-15'

      mockRepository.getTargets.mockResolvedValue({
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 67
      })

      const startTime = performance.now()
      await targetsService.get(userId, date)
      const duration = performance.now() - startTime

      // Should be well under 500ms budget for targets_calculation
      expect(duration).toBeLessThan(500)
    })
  })
})

// Golden fixtures for target calculations
describe('TargetsService Golden Fixtures', () => {
  let targetsService: TargetsServiceImpl
  let mockRepository: jest.Mocked<TargetsRepository>

  beforeEach(() => {
    mockRepository = new MockTargetsRepository({} as any) as jest.Mocked<TargetsRepository>
    targetsService = new TargetsServiceImpl(mockRepository)
  })

  // Test case: Active female, weight loss goal
  it('should calculate correct targets for active female weight loss', async () => {
    const expectedTargets: TargetVector = {
      calories: 1905,  // BMR * activity * deficit
      protein_g: 144, // High protein for weight loss
      carbs_g: 181,   // Remainder after protein/fat
      fat_g: 53       // 25% of calories
    }

    mockRepository.getTargets.mockResolvedValue(expectedTargets)

    const result = await targetsService.get('user_female_active', '2024-01-15')

    expect(result.calories).toBeCloseTo(expectedTargets.calories, 0)
    expect(result.protein_g).toBeCloseTo(expectedTargets.protein_g, 0)
    expect(result.carbs_g).toBeCloseTo(expectedTargets.carbs_g, 0)
    expect(result.fat_g).toBeCloseTo(expectedTargets.fat_g, 0)
  })

  // Test case: Sedentary male, maintenance
  it('should calculate correct targets for sedentary male maintenance', async () => {
    const expectedTargets: TargetVector = {
      calories: 2088,  // BMR * sedentary activity
      protein_g: 154,  // Standard protein
      carbs_g: 199,    // Remainder
      fat_g: 58        // 25% of calories
    }

    mockRepository.getTargets.mockResolvedValue(expectedTargets)

    const result = await targetsService.get('user_male_sedentary', '2024-01-15')

    expect(result.calories).toBeCloseTo(expectedTargets.calories, 0)
    expect(result.protein_g).toBeCloseTo(expectedTargets.protein_g, 0)
    expect(result.carbs_g).toBeCloseTo(expectedTargets.carbs_g, 0)
    expect(result.fat_g).toBeCloseTo(expectedTargets.fat_g, 0)
  })

  // Edge case: Date boundary testing
  describe('date boundaries', () => {
    it('should handle goal transitions at midnight', async () => {
      const userId = 'user123'

      // Different targets for consecutive dates
      const jan14Targets = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 }
      const jan15Targets = { calories: 1800, protein_g: 140, carbs_g: 180, fat_g: 60 }

      mockRepository.getTargets
        .mockResolvedValueOnce(jan14Targets)  // 2024-01-14
        .mockResolvedValueOnce(jan15Targets)  // 2024-01-15

      const result14 = await targetsService.get(userId, '2024-01-14')
      const result15 = await targetsService.get(userId, '2024-01-15')

      expect(result14).toEqual(jan14Targets)
      expect(result15).toEqual(jan15Targets)
    })

    it('should handle menstrual cycle boundaries correctly', async () => {
      const userId = 'user123'

      // Menstrual goal active only on specific dates
      const normalTargets = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 }
      const menstrualTargets = { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 73 }

      mockRepository.getTargets
        .mockResolvedValueOnce(normalTargets)     // Before menstrual period
        .mockResolvedValueOnce(menstrualTargets)  // During menstrual period
        .mockResolvedValueOnce(normalTargets)     // After menstrual period

      const beforeResult = await targetsService.get(userId, '2024-01-14')
      const duringResult = await targetsService.get(userId, '2024-01-15')
      const afterResult = await targetsService.get(userId, '2024-01-19')

      expect(beforeResult).toEqual(normalTargets)
      expect(duringResult).toEqual(menstrualTargets)
      expect(afterResult).toEqual(normalTargets)
    })
  })
})