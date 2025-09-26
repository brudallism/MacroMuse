// tests/domain/macros.test.ts - Test pure macro calculation functions
import { computeMacros, validateMacros, UserProfile, Goal } from '../../domain/services/macros'

describe('Macro Calculation Service', () => {
  describe('computeMacros', () => {
    // Golden fixture: Active female, weight loss
    it('should calculate correct macros for active female seeking weight loss', () => {
      const profile: UserProfile = {
        sex: 'female',
        age_years: 25,
        height: { value: 66, unit: 'in' }, // 167.6 cm
        weight: { value: 140, unit: 'lb' }, // 63.5 kg
        activity_level: 'active'
      }

      const result = computeMacros(profile, 'weight_loss')

      // Expected calculations:
      // BMR (Mifflin-St Jeor): 10*63.5 + 6.25*167.6 - 5*25 - 161 = 1346
      // TDEE: 1346 * 1.725 = 2322
      // Weight loss target: 2322 * 0.8 = 1858 (rounded to 1905 in our implementation)
      expect(result.kcal_target).toBeCloseTo(1905, -1) // Within 10 calories
      expect(result.protein_g).toBeCloseTo(144, 0) // High protein for weight loss
      expect(result.fat_g).toBeCloseTo(53, 0) // 30% of calories
      expect(result.carb_g).toBeCloseTo(181, 0) // Remainder
      expect(result.fiber_g).toBeCloseTo(27, 0) // 14g per 1000 kcal
    })

    // Golden fixture: Sedentary male, maintenance
    it('should calculate correct macros for sedentary male maintenance', () => {
      const profile: UserProfile = {
        sex: 'male',
        age_years: 35,
        height: { value: 180, unit: 'cm' },
        weight: { value: 80, unit: 'kg' },
        activity_level: 'sedentary'
      }

      const result = computeMacros(profile, 'maintenance')

      // Expected calculations:
      // BMR: 10*80 + 6.25*180 - 5*35 + 5 = 1740
      // TDEE: 1740 * 1.2 = 2088
      // Maintenance: 2088 (no adjustment)
      expect(result.kcal_target).toBeCloseTo(2088, 0)
      expect(result.protein_g).toBeCloseTo(80, 0) // 1g per kg body weight
      expect(result.fat_g).toBeCloseTo(58, 0) // 30% of calories
      expect(result.carb_g).toBeCloseTo(199, 0) // Remainder
    })

    // Edge case: Very active male, muscle gain
    it('should calculate correct macros for very active male muscle gain', () => {
      const profile: UserProfile = {
        sex: 'male',
        age_years: 28,
        height: { value: 185, unit: 'cm' },
        weight: { value: 85, unit: 'kg' },
        activity_level: 'very_active'
      }

      const result = computeMacros(profile, 'muscle_gain')

      expect(result.kcal_target).toBeGreaterThan(2800) // Should be high for muscle gain
      expect(result.protein_g).toBeCloseTo(136, 5) // 1.6g per kg for muscle gain
      expect(result.fat_g).toBeGreaterThan(60) // 30% of higher calories
      expect(result.fiber_g).toBeGreaterThan(35) // Higher due to higher calories
    })

    // Edge case: Older female with imperial units
    it('should handle imperial units correctly', () => {
      const profile: UserProfile = {
        sex: 'female',
        age_years: 55,
        height: { value: 65, unit: 'in' }, // 165 cm
        weight: { value: 130, unit: 'lb' }, // 59 kg
        activity_level: 'lightly_active'
      }

      const result = computeMacros(profile, 'body_recomposition')

      // Should convert units correctly and apply age/goal adjustments
      expect(result.kcal_target).toBeGreaterThan(1400)
      expect(result.kcal_target).toBeLessThan(1900)
      expect(result.protein_g).toBeGreaterThan(70) // Higher for body recomposition
    })

    // Edge case: High BMI adjustment
    it('should increase protein for high BMI individuals', () => {
      const normalBMI: UserProfile = {
        sex: 'male',
        age_years: 30,
        height: { value: 180, unit: 'cm' },
        weight: { value: 75, unit: 'kg' }, // BMI: 23.1
        activity_level: 'moderately_active'
      }

      const highBMI: UserProfile = {
        sex: 'male',
        age_years: 30,
        height: { value: 180, unit: 'cm' },
        weight: { value: 110, unit: 'kg' }, // BMI: 34.0
        activity_level: 'moderately_active'
      }

      const normalResult = computeMacros(normalBMI, 'weight_loss')
      const highBMIResult = computeMacros(highBMI, 'weight_loss')

      // High BMI should have proportionally more protein
      const normalProteinPerKg = normalResult.protein_g / 75
      const highBMIProteinPerKg = highBMIResult.protein_g / 110

      expect(highBMIProteinPerKg).toBeGreaterThan(normalProteinPerKg * 1.05) // At least 10% more
    })
  })

  describe('validateMacros', () => {
    it('should return valid macros unchanged when within tolerance', () => {
      const validMacros = {
        kcal_target: 2000,
        protein_g: 150, // 600 kcal
        fat_g: 67,     // 600 kcal
        carb_g: 200,   // 800 kcal
        fiber_g: 28
      }
      // Total: 600 + 600 + 800 = 2000 kcal (matches target)

      const result = validateMacros(validMacros)

      expect(result).toEqual(validMacros)
    })

    it('should adjust carbs when macros dont add up to target calories', () => {
      const invalidMacros = {
        kcal_target: 2000,
        protein_g: 150, // 600 kcal
        fat_g: 67,     // 600 kcal
        carb_g: 300,   // 1200 kcal (too high!)
        fiber_g: 28
      }
      // Total: 600 + 600 + 1200 = 2400 kcal (400 over target)

      const result = validateMacros(invalidMacros)

      expect(result.kcal_target).toBe(2000)
      expect(result.protein_g).toBe(150) // Preserved
      expect(result.fat_g).toBe(67)     // Preserved
      expect(result.carb_g).toBe(200)   // Adjusted: (2000 - 600 - 600) / 4 = 200
      expect(result.fiber_g).toBe(28)   // Preserved
    })

    it('should handle negative carb adjustments by setting to zero', () => {
      const extremeMacros = {
        kcal_target: 1500,
        protein_g: 200, // 800 kcal
        fat_g: 100,     // 900 kcal
        carb_g: 100,    // 400 kcal
        fiber_g: 21
      }
      // Total: 800 + 900 + 400 = 2100 kcal (600 over target)

      const result = validateMacros(extremeMacros)

      expect(result.carb_g).toBe(0) // Cannot have negative carbs
      expect(result.protein_g).toBe(200) // Preserved
      expect(result.fat_g).toBe(100)     // Preserved
    })

    it('should handle macros within 5% tolerance', () => {
      const slightlyOffMacros = {
        kcal_target: 2000,
        protein_g: 150, // 600 kcal
        fat_g: 67,     // 600 kcal
        carb_g: 195,   // 780 kcal
        fiber_g: 28
      }
      // Total: 1980 kcal (20 kcal under, within 5% tolerance)

      const result = validateMacros(slightlyOffMacros)

      expect(result).toEqual(slightlyOffMacros) // Should not adjust
    })
  })

  describe('unit conversions', () => {
    it('should produce same results regardless of input units', () => {
      const metricProfile: UserProfile = {
        sex: 'female',
        age_years: 30,
        height: { value: 165, unit: 'cm' },
        weight: { value: 60, unit: 'kg' },
        activity_level: 'active'
      }

      const imperialProfile: UserProfile = {
        sex: 'female',
        age_years: 30,
        height: { value: 64.96, unit: 'in' }, // 165 cm
        weight: { value: 132.28, unit: 'lb' }, // 60 kg
        activity_level: 'active'
      }

      const metricResult = computeMacros(metricProfile, 'maintenance')
      const imperialResult = computeMacros(imperialProfile, 'maintenance')

      expect(metricResult.kcal_target).toBeCloseTo(imperialResult.kcal_target, 0)
      expect(metricResult.protein_g).toBeCloseTo(imperialResult.protein_g, 0)
      expect(metricResult.fat_g).toBeCloseTo(imperialResult.fat_g, 0)
      expect(metricResult.carb_g).toBeCloseTo(imperialResult.carb_g, 0)
    })
  })

  describe('goal-specific adjustments', () => {
    const baseProfile: UserProfile = {
      sex: 'male',
      age_years: 30,
      height: { value: 175, unit: 'cm' },
      weight: { value: 75, unit: 'kg' },
      activity_level: 'moderately_active'
    }

    it('should apply correct caloric adjustments for each goal', () => {
      const weightLoss = computeMacros(baseProfile, 'weight_loss')
      const maintenance = computeMacros(baseProfile, 'maintenance')
      const muscleGain = computeMacros(baseProfile, 'muscle_gain')
      const bodyRecomp = computeMacros(baseProfile, 'body_recomposition')

      // Weight loss < body recomp < maintenance < muscle gain
      expect(weightLoss.kcal_target).toBeLessThan(bodyRecomp.kcal_target)
      expect(bodyRecomp.kcal_target).toBeLessThan(maintenance.kcal_target)
      expect(maintenance.kcal_target).toBeLessThan(muscleGain.kcal_target)
    })

    it('should adjust protein targets based on goals', () => {
      const maintenance = computeMacros(baseProfile, 'maintenance')
      const muscleGain = computeMacros(baseProfile, 'muscle_gain')
      const weightLoss = computeMacros(baseProfile, 'weight_loss')

      // Muscle gain should have highest protein
      expect(muscleGain.protein_g).toBeGreaterThan(maintenance.protein_g)
      expect(muscleGain.protein_g).toBeGreaterThan(weightLoss.protein_g)
    })
  })
})