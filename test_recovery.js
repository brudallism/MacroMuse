// Quick test of recovered domain services
const { computeMacros } = require('./app/domain/services/macros.ts')
const { computeMicros } = require('./app/domain/services/micros.ts')

// Test macro calculation
const profile = {
  sex: 'female',
  age_years: 25,
  height: { value: 66, unit: 'in' },
  weight: { value: 140, unit: 'lb' },
  activity_level: 'active'
}

try {
  const macros = computeMacros(profile, 'weight_loss')
  console.log('✅ Macro calculation works:', macros)

  // Test micro calculation
  const microProfile = {
    sex: 'male',
    age_years: 35,
    height_cm: 185,
    weight_kg: 86,
    activity_level: 'very_active'
  }

  const micros = computeMicros(microProfile, 2875, 'muscle_gain', ['blood_sugar'])
  console.log('✅ Micro calculation works:', micros.length, 'nutrients')
  console.log('✅ Core domain services recovered successfully!')
} catch (error) {
  console.error('❌ Error:', error.message)
}