// Pure micronutrient calculation engine - zero external dependencies
// Implements RDA-based micronutrient targeting with goal and modifier overlays

export interface MicroProfile {
  sex: 'male' | 'female'
  age_years: number
  height_cm: number
  weight_kg: number
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
}

export type Goal = 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
export type Modifier = 'blood_sugar' | 'digestive_support' | 'hormonal_support'

export interface MicronutrientTarget {
  nutrient: string
  target: number
  unit: string
  upper_limit?: number
  rationale: string
  highlighted: boolean // True for goal/modifier specific highlights
}

// Embedded RDA data (normally would be in a database)
const RDA_DATA = {
  // Adult male (19-50)
  male: {
    vitamin_c_mg: 90,
    vitamin_d_iu: 600,
    vitamin_e_mg: 15,
    vitamin_k_mcg: 120,
    thiamine_mg: 1.2,
    riboflavin_mg: 1.3,
    niacin_mg: 16,
    vitamin_b6_mg: 1.3,
    folate_mcg: 400,
    vitamin_b12_mcg: 2.4,
    biotin_mcg: 30,
    pantothenic_acid_mg: 5,
    choline_mg: 550,
    calcium_mg: 1000,
    iron_mg: 8,
    magnesium_mg: 400,
    phosphorus_mg: 700,
    potassium_mg: 3500,
    sodium_mg: 2300, // Upper limit, not RDA
    zinc_mg: 11,
    copper_mg: 0.9,
    manganese_mg: 2.3,
    selenium_mcg: 55,
    chromium_mcg: 35,
    molybdenum_mcg: 45,
  },
  // Adult female (19-50)
  female: {
    vitamin_c_mg: 75,
    vitamin_d_iu: 600,
    vitamin_e_mg: 15,
    vitamin_k_mcg: 90,
    thiamine_mg: 1.1,
    riboflavin_mg: 1.1,
    niacin_mg: 14,
    vitamin_b6_mg: 1.3,
    folate_mcg: 400,
    vitamin_b12_mcg: 2.4,
    biotin_mcg: 30,
    pantothenic_acid_mg: 5,
    choline_mg: 425,
    calcium_mg: 1000,
    iron_mg: 18,
    magnesium_mg: 310,
    phosphorus_mg: 700,
    potassium_mg: 2600,
    sodium_mg: 2300,
    zinc_mg: 8,
    copper_mg: 0.9,
    manganese_mg: 1.8,
    selenium_mcg: 55,
    chromium_mcg: 25,
    molybdenum_mcg: 45,
  }
} as const

// Upper limits (UL) where applicable
const UPPER_LIMITS = {
  vitamin_c_mg: 2000,
  vitamin_d_iu: 4000,
  vitamin_e_mg: 1000,
  niacin_mg: 35,
  vitamin_b6_mg: 100,
  folate_mcg: 1000,
  choline_mg: 3500,
  calcium_mg: 2500,
  iron_mg: 45,
  magnesium_mg: 350, // From supplements only
  phosphorus_mg: 4000,
  sodium_mg: 2300,
  zinc_mg: 40,
  copper_mg: 10,
  manganese_mg: 11,
  selenium_mcg: 400,
  molybdenum_mcg: 2000,
} as const

// Goal-based micronutrient highlights
const GOAL_HIGHLIGHTS = {
  muscle_gain: [
    'vitamin_b6_mg',
    'vitamin_b12_mcg',
    'magnesium_mg',
    'zinc_mg',
    'iron_mg'
  ],
  weight_loss: [
    'chromium_mcg',
    'vitamin_d_iu',
    'magnesium_mg',
    'iron_mg'
  ],
  body_recomposition: [
    'vitamin_d_iu',
    'magnesium_mg',
    'zinc_mg',
    'chromium_mcg'
  ],
  maintenance: []
} as const

// Modifier-based micronutrient highlights
const MODIFIER_HIGHLIGHTS = {
  blood_sugar: [
    'chromium_mcg',
    'magnesium_mg',
    'vitamin_d_iu',
    'zinc_mg'
  ],
  digestive_support: [
    'vitamin_c_mg',
    'zinc_mg',
    'magnesium_mg',
    'vitamin_d_iu'
  ],
  hormonal_support: [
    'vitamin_d_iu',
    'magnesium_mg',
    'zinc_mg',
    'vitamin_b6_mg'
  ]
} as const

function getBaseRDA(sex: 'male' | 'female', nutrient: string): number {
  const data = RDA_DATA[sex] as any
  return data[nutrient] || 0
}

function getUpperLimit(nutrient: string): number | undefined {
  const limits = UPPER_LIMITS as any
  return limits[nutrient]
}

function isHighlighted(nutrient: string, goal: Goal, modifiers: Modifier[]): boolean {
  // Check goal highlights
  const goalHighlights = GOAL_HIGHLIGHTS[goal] || []
  if (goalHighlights.includes(nutrient)) return true

  // Check modifier highlights
  for (const modifier of modifiers) {
    const modifierHighlights = MODIFIER_HIGHLIGHTS[modifier] || []
    if (modifierHighlights.includes(nutrient)) return true
  }

  return false
}

function getRationale(nutrient: string, goal: Goal, modifiers: Modifier[]): string {
  const reasons = []

  // Goal-based rationales
  if (goal === 'muscle_gain' && ['vitamin_b6_mg', 'vitamin_b12_mcg', 'magnesium_mg', 'zinc_mg', 'iron_mg'].includes(nutrient)) {
    reasons.push('supports muscle protein synthesis')
  }
  if (goal === 'weight_loss' && ['chromium_mcg', 'vitamin_d_iu', 'magnesium_mg'].includes(nutrient)) {
    reasons.push('supports metabolism')
  }

  // Modifier-based rationales
  if (modifiers.includes('blood_sugar') && ['chromium_mcg', 'magnesium_mg', 'vitamin_d_iu', 'zinc_mg'].includes(nutrient)) {
    reasons.push('helps regulate blood sugar')
  }
  if (modifiers.includes('digestive_support') && ['vitamin_c_mg', 'zinc_mg', 'magnesium_mg'].includes(nutrient)) {
    reasons.push('supports digestive health')
  }
  if (modifiers.includes('hormonal_support') && ['vitamin_d_iu', 'magnesium_mg', 'zinc_mg', 'vitamin_b6_mg'].includes(nutrient)) {
    reasons.push('supports hormonal balance')
  }

  return reasons.length > 0 ? reasons.join(', ') : 'meets daily requirements'
}

// Energy-scaled nutrients (fiber)
function calculateFiber(calories: number): number {
  return Math.round((calories / 1000) * 14) // 14g per 1000 kcal
}

export function computeMicros(
  profile: MicroProfile,
  calories: number,
  goal: Goal,
  modifiers: Modifier[] = []
): MicronutrientTarget[] {
  const targets: MicronutrientTarget[] = []

  // Get all nutrients from RDA data
  const rdaData = RDA_DATA[profile.sex]

  for (const [nutrient, baseTarget] of Object.entries(rdaData)) {
    let target = baseTarget

    // Activity level adjustments for select nutrients
    if (profile.activity_level === 'very_active') {
      if (['vitamin_c_mg', 'vitamin_e_mg', 'magnesium_mg'].includes(nutrient)) {
        target *= 1.1 // 10% increase for very active
      }
    }

    // Age adjustments (simplified)
    if (profile.age_years > 50) {
      if (nutrient === 'vitamin_d_iu') target = 800 // Higher for 50+
      if (nutrient === 'vitamin_b12_mcg') target *= 1.5 // Higher absorption needs
    }

    const upperLimit = getUpperLimit(nutrient)
    const highlighted = isHighlighted(nutrient, goal, modifiers)
    const rationale = getRationale(nutrient, goal, modifiers)

    // Apply upper limit clamping (special case for magnesium - only for supplements)
    let finalTarget = target
    if (upperLimit && nutrient !== 'magnesium_mg') {
      finalTarget = Math.min(target, upperLimit)
    }

    targets.push({
      nutrient,
      target: Math.round(finalTarget * 100) / 100, // Round to 2 decimals
      unit: nutrient.includes('mcg') ? 'mcg' : nutrient.includes('iu') ? 'IU' : 'mg',
      upper_limit: upperLimit,
      rationale,
      highlighted,
    })
  }

  // Add fiber (energy-scaled)
  targets.push({
    nutrient: 'fiber_g',
    target: calculateFiber(calories),
    unit: 'g',
    rationale: '14g per 1000 calories for digestive health',
    highlighted: modifiers.includes('digestive_support'),
  })

  return targets.sort((a, b) => a.nutrient.localeCompare(b.nutrient))
}