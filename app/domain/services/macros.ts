// Pure macro calculation engine - zero external dependencies
// Implements Mifflin-St Jeor BMR calculation with goal-based macro distribution

import { NutrientVector } from '../models'

export interface UserProfile {
  sex: 'male' | 'female'
  age_years: number
  height: { value: number; unit: 'in' | 'cm' }
  weight: { value: number; unit: 'lb' | 'kg' }
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
}

export type Goal = 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'

export interface MacroTargets {
  kcal_target: number
  protein_g: number
  fat_g: number
  carb_g: number
  fiber_g: number
}

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const

// Goal-based caloric adjustments (% of TDEE)
const GOAL_ADJUSTMENTS = {
  weight_loss: -0.20,  // 20% deficit
  maintenance: 0,      // No adjustment
  muscle_gain: 0.15,   // 15% surplus
  body_recomposition: -0.10, // Small deficit
} as const

function convertToMetric(profile: UserProfile): {
  height_cm: number
  weight_kg: number
} {
  const height_cm = profile.height.unit === 'cm'
    ? profile.height.value
    : profile.height.value * 2.54

  const weight_kg = profile.weight.unit === 'kg'
    ? profile.weight.value
    : profile.weight.value * 0.453592

  return { height_cm, weight_kg }
}

function calculateBMR(profile: UserProfile): number {
  const { height_cm, weight_kg } = convertToMetric(profile)

  // Mifflin-St Jeor equation
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * profile.age_years
  return profile.sex === 'male' ? base + 5 : base - 161
}

function calculateTDEE(bmr: number, activityLevel: UserProfile['activity_level']): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

function calculateProteinTarget(profile: UserProfile, goal: Goal): number {
  const { weight_kg } = convertToMetric(profile)

  // Base protein: 0.8-1.2g per kg body weight
  let proteinPerKg = 1.0

  // Adjust for goal
  if (goal === 'muscle_gain') proteinPerKg = 1.6
  if (goal === 'weight_loss') proteinPerKg = 1.2
  if (goal === 'body_recomposition') proteinPerKg = 1.4

  // Higher protein for higher BMI cases
  const bmi = weight_kg / Math.pow(convertToMetric(profile).height_cm / 100, 2)
  if (bmi > 30) proteinPerKg *= 1.1

  return weight_kg * proteinPerKg
}

export function computeMacros(profile: UserProfile, goal: Goal): MacroTargets {
  const bmr = calculateBMR(profile)
  const tdee = calculateTDEE(bmr, profile.activity_level)
  const kcal_target = Math.round(tdee * (1 + GOAL_ADJUSTMENTS[goal]))

  // Calculate macros
  const protein_g = Math.round(calculateProteinTarget(profile, goal))
  const protein_kcal = protein_g * 4

  // Fat: 25-35% of calories (use 30%)
  const fat_kcal = Math.round(kcal_target * 0.30)
  const fat_g = Math.round(fat_kcal / 9)

  // Carbs: remainder
  const remaining_kcal = kcal_target - protein_kcal - fat_kcal
  const carb_g = Math.round(remaining_kcal / 4)

  // Fiber: 14g per 1000 kcal
  const fiber_g = Math.round((kcal_target / 1000) * 14)

  return {
    kcal_target,
    protein_g,
    fat_g,
    carb_g,
    fiber_g,
  }
}

// Validate and resolve impossible macro combinations
export function validateMacros(targets: MacroTargets): MacroTargets {
  const { kcal_target, protein_g, fat_g, carb_g, fiber_g } = targets

  const calculated_kcal = (protein_g * 4) + (fat_g * 9) + (carb_g * 4)

  // If macros don't add up to target calories (within 5% tolerance)
  const tolerance = kcal_target * 0.05
  if (Math.abs(calculated_kcal - kcal_target) > tolerance) {
    // Prioritize protein, adjust carbs
    const protein_kcal = protein_g * 4
    const fat_kcal = fat_g * 9
    const adjusted_carb_kcal = kcal_target - protein_kcal - fat_kcal
    const adjusted_carb_g = Math.max(0, Math.round(adjusted_carb_kcal / 4))

    return {
      kcal_target,
      protein_g,
      fat_g,
      carb_g: adjusted_carb_g,
      fiber_g,
    }
  }

  return targets
}