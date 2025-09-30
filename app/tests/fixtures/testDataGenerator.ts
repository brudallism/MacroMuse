import { LogEntry, NutrientVector } from '../../domain/models'

interface HeavyUserTestData {
  userId: string
  startDate: string
  endDate: string
  logEntries: LogEntry[]
  dailyAverages: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

interface TestDataOptions {
  lowIron?: boolean
  highSodium?: boolean
  inconsistentCalories?: boolean
  vegetarian?: boolean
  highProtein?: boolean
}

// Common food items with realistic nutritional profiles
const COMMON_FOODS = [
  {
    name: 'Grilled Chicken Breast',
    nutrients: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, iron_mg: 0.7, sodium_mg: 74 },
    portions: [100, 150, 200, 250]
  },
  {
    name: 'Brown Rice Cooked',
    nutrients: { calories: 123, protein_g: 2.6, carbs_g: 23, fat_g: 0.9, iron_mg: 0.4, sodium_mg: 1 },
    portions: [100, 150, 200]
  },
  {
    name: 'Salmon Fillet',
    nutrients: { calories: 208, protein_g: 22, carbs_g: 0, fat_g: 12, iron_mg: 0.3, sodium_mg: 47 },
    portions: [100, 150, 200]
  },
  {
    name: 'Greek Yogurt Plain',
    nutrients: { calories: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4, iron_mg: 0.04, sodium_mg: 36 },
    portions: [100, 150, 200, 250]
  },
  {
    name: 'Whole Wheat Bread',
    nutrients: { calories: 247, protein_g: 13, carbs_g: 41, fat_g: 4.2, iron_mg: 2.5, sodium_mg: 494 },
    portions: [25, 50, 75] // per slice
  },
  {
    name: 'Broccoli Steamed',
    nutrients: { calories: 35, protein_g: 2.8, carbs_g: 7, fat_g: 0.4, iron_mg: 0.7, sodium_mg: 33 },
    portions: [100, 150, 200]
  },
  {
    name: 'Quinoa Cooked',
    nutrients: { calories: 120, protein_g: 4.4, carbs_g: 22, fat_g: 1.9, iron_mg: 1.5, sodium_mg: 7 },
    portions: [100, 150, 200]
  },
  {
    name: 'Almonds Raw',
    nutrients: { calories: 579, protein_g: 21, carbs_g: 22, fat_g: 50, iron_mg: 3.9, sodium_mg: 1 },
    portions: [15, 30, 45] // small portions due to high calories
  },
  {
    name: 'Sweet Potato Baked',
    nutrients: { calories: 90, protein_g: 2, carbs_g: 21, fat_g: 0.2, iron_mg: 0.7, sodium_mg: 6 },
    portions: [100, 150, 200]
  },
  {
    name: 'Avocado Fresh',
    nutrients: { calories: 160, protein_g: 2, carbs_g: 9, fat_g: 15, iron_mg: 0.6, sodium_mg: 7 },
    portions: [50, 100, 150]
  },
  {
    name: 'Lean Ground Beef',
    nutrients: { calories: 250, protein_g: 26, carbs_g: 0, fat_g: 15, iron_mg: 2.6, sodium_mg: 75 },
    portions: [100, 150, 200]
  },
  {
    name: 'Black Beans Cooked',
    nutrients: { calories: 132, protein_g: 8.9, carbs_g: 24, fat_g: 0.5, iron_mg: 1.8, sodium_mg: 2 },
    portions: [100, 150, 200]
  },
  {
    name: 'Olive Oil Extra Virgin',
    nutrients: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, iron_mg: 0.6, sodium_mg: 2 },
    portions: [5, 10, 15] // tablespoon portions
  },
  {
    name: 'Steel Cut Oats',
    nutrients: { calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3, iron_mg: 2, sodium_mg: 0 },
    portions: [40, 60, 80] // dry weight
  },
  {
    name: 'Spinach Fresh',
    nutrients: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, iron_mg: 2.7, sodium_mg: 79 },
    portions: [50, 100, 150]
  }
]

// Meal distribution patterns
const MEAL_PATTERNS = {
  breakfast: ['Steel Cut Oats', 'Greek Yogurt Plain', 'Whole Wheat Bread', 'Avocado Fresh'],
  lunch: ['Grilled Chicken Breast', 'Brown Rice Cooked', 'Quinoa Cooked', 'Broccoli Steamed', 'Spinach Fresh'],
  dinner: ['Salmon Fillet', 'Lean Ground Beef', 'Sweet Potato Baked', 'Black Beans Cooked', 'Broccoli Steamed'],
  snack: ['Almonds Raw', 'Greek Yogurt Plain', 'Avocado Fresh']
}

export const generateHeavyUserTestData = async (
  userId: string,
  daysCount: number,
  options: TestDataOptions = {}
): Promise<HeavyUserTestData> => {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysCount)

  const endDate = new Date()

  const logEntries: LogEntry[] = []
  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  for (let day = 0; day < daysCount; day++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + day)
    const dateISO = currentDate.toISOString().split('T')[0]

    // Generate 3-5 meals per day
    const mealsPerDay = Math.floor(Math.random() * 3) + 3

    for (let meal = 0; meal < mealsPerDay; meal++) {
      const mealType = getMealType(meal, mealsPerDay)
      const foods = selectFoodsForMeal(mealType, options)

      for (const food of foods) {
        const portion = food.portions[Math.floor(Math.random() * food.portions.length)]
        const scalingFactor = portion / 100

        const scaledNutrients: NutrientVector = {
          calories: Math.round((food.nutrients.calories || 0) * scalingFactor),
          protein_g: Math.round((food.nutrients.protein_g || 0) * scalingFactor * 10) / 10,
          carbs_g: Math.round((food.nutrients.carbs_g || 0) * scalingFactor * 10) / 10,
          fat_g: Math.round((food.nutrients.fat_g || 0) * scalingFactor * 10) / 10,
          iron_mg: Math.round((food.nutrients.iron_mg || 0) * scalingFactor * 100) / 100,
          sodium_mg: Math.round((food.nutrients.sodium_mg || 0) * scalingFactor)
        }

        // Apply options modifications
        if (options.lowIron && scaledNutrients.iron_mg) {
          scaledNutrients.iron_mg *= 0.3 // Reduce iron content
        }

        if (options.highSodium && scaledNutrients.sodium_mg) {
          scaledNutrients.sodium_mg *= 2.5 // Increase sodium
        }

        if (options.inconsistentCalories && scaledNutrients.calories) {
          const variance = Math.random() * 0.6 + 0.7 // 70% - 130% variance
          scaledNutrients.calories = Math.round(scaledNutrients.calories * variance)
        }

        const entry: LogEntry = {
          id: `test-entry-${day}-${meal}-${food.name.replace(/\s+/g, '-').toLowerCase()}`,
          userId,
          loggedAt: `${dateISO}T${generateMealTime(mealType)}:00.000Z`,
          source: 'usda',
          sourceId: `usda-${food.name.replace(/\s+/g, '-').toLowerCase()}`,
          qty: portion,
          unit: 'g',
          nutrients: scaledNutrients,
          mealLabel: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack'
        }

        logEntries.push(entry)

        // Accumulate totals for averages
        totalCalories += scaledNutrients.calories || 0
        totalProtein += scaledNutrients.protein_g || 0
        totalCarbs += scaledNutrients.carbs_g || 0
        totalFat += scaledNutrients.fat_g || 0
      }
    }
  }

  const dailyAverages = {
    calories: Math.round(totalCalories / daysCount),
    protein_g: Math.round((totalProtein / daysCount) * 10) / 10,
    carbs_g: Math.round((totalCarbs / daysCount) * 10) / 10,
    fat_g: Math.round((totalFat / daysCount) * 10) / 10
  }

  return {
    userId,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    logEntries,
    dailyAverages
  }
}

export const generateRecipeTestData = async (
  userId: string,
  recipeCount: number
): Promise<any[]> => {
  const recipes = []

  const recipeNames = [
    'Power Protein Bowl', 'Mediterranean Quinoa Salad', 'Asian Chicken Stir Fry',
    'Salmon with Roasted Vegetables', 'Black Bean and Sweet Potato Tacos',
    'Greek Yogurt Parfait', 'Overnight Oats with Berries', 'Chicken Caesar Salad',
    'Veggie Packed Omelet', 'Turkey and Avocado Wrap', 'Lentil Curry Bowl',
    'Grilled Chicken with Quinoa', 'Baked Cod with Broccoli', 'Beef and Vegetable Stew',
    'Spinach and Mushroom Frittata', 'Tuna Salad with Mixed Greens',
    'Chicken Tikka Masala', 'Vegetable Fried Rice', 'Pork Tenderloin with Apples',
    'Shrimp and Zucchini Noodles', 'Bean and Vegetable Chili', 'Stuffed Bell Peppers',
    'Chicken Fajita Bowl', 'Baked Salmon with Asparagus', 'Turkey Meatballs with Pasta'
  ]

  for (let i = 0; i < recipeCount; i++) {
    const name = recipeNames[i % recipeNames.length] + (i >= recipeNames.length ? ` ${Math.floor(i / recipeNames.length) + 1}` : '')

    // Generate random number of ingredients (3-12)
    const ingredientCount = Math.floor(Math.random() * 10) + 3
    const ingredients = []

    for (let j = 0; j < ingredientCount; j++) {
      const food = COMMON_FOODS[Math.floor(Math.random() * COMMON_FOODS.length)]
      const amount = food.portions[Math.floor(Math.random() * food.portions.length)]

      ingredients.push({
        foodId: `test-${food.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: food.name,
        amount,
        unit: 'g',
        nutrients: food.nutrients
      })
    }

    recipes.push({
      id: `test-recipe-${i}`,
      userId,
      name,
      description: `Test recipe ${i + 1} for performance testing`,
      servings: Math.floor(Math.random() * 4) + 2, // 2-6 servings
      ingredients,
      instructions: `Test instructions for ${name}`,
      prepTime: Math.floor(Math.random() * 30) + 10, // 10-40 minutes
      cookTime: Math.floor(Math.random() * 60) + 15, // 15-75 minutes
      tags: generateRecipeTags(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return recipes
}

export const generateLogEntry = (userId: string, foodName: string): LogEntry => {
  const food = COMMON_FOODS.find(f => f.name.toLowerCase().includes(foodName.toLowerCase())) || COMMON_FOODS[0]
  const portion = food.portions[Math.floor(Math.random() * food.portions.length)]
  const scalingFactor = portion / 100

  const scaledNutrients: NutrientVector = {
    calories: Math.round((food.nutrients.calories || 0) * scalingFactor),
    protein_g: Math.round((food.nutrients.protein_g || 0) * scalingFactor * 10) / 10,
    carbs_g: Math.round((food.nutrients.carbs_g || 0) * scalingFactor * 10) / 10,
    fat_g: Math.round((food.nutrients.fat_g || 0) * scalingFactor * 10) / 10,
    iron_mg: Math.round((food.nutrients.iron_mg || 0) * scalingFactor * 100) / 100,
    sodium_mg: Math.round((food.nutrients.sodium_mg || 0) * scalingFactor)
  }

  return {
    id: `test-entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    loggedAt: new Date().toISOString(),
    source: 'usda',
    sourceId: `usda-${food.name.replace(/\s+/g, '-').toLowerCase()}`,
    qty: portion,
    unit: 'g',
    nutrients: scaledNutrients,
    mealLabel: ['breakfast', 'lunch', 'dinner', 'snack'][Math.floor(Math.random() * 4)] as 'breakfast' | 'lunch' | 'dinner' | 'snack'
  }
}

// Helper functions
function getMealType(mealIndex: number, totalMeals: number): string {
  if (totalMeals === 3) {
    return ['breakfast', 'lunch', 'dinner'][mealIndex]
  } else if (totalMeals === 4) {
    return ['breakfast', 'lunch', 'snack', 'dinner'][mealIndex]
  } else {
    const types = ['breakfast', 'snack', 'lunch', 'snack', 'dinner']
    return types[mealIndex] || 'snack'
  }
}

function selectFoodsForMeal(mealType: string, options: TestDataOptions): typeof COMMON_FOODS {
  const mealFoods = MEAL_PATTERNS[mealType as keyof typeof MEAL_PATTERNS] || MEAL_PATTERNS.lunch

  // Select 1-3 foods for this meal
  const foodCount = Math.floor(Math.random() * 3) + 1
  const selectedFoodNames = []

  for (let i = 0; i < foodCount; i++) {
    const foodName = mealFoods[Math.floor(Math.random() * mealFoods.length)]
    if (!selectedFoodNames.includes(foodName)) {
      selectedFoodNames.push(foodName)
    }
  }

  return selectedFoodNames.map(name =>
    COMMON_FOODS.find(food => food.name === name) || COMMON_FOODS[0]
  )
}

function generateMealTime(mealType: string): string {
  const times = {
    breakfast: ['07', '08', '09'],
    lunch: ['12', '13', '14'],
    dinner: ['18', '19', '20'],
    snack: ['10', '15', '21']
  }

  const mealTimes = times[mealType as keyof typeof times] || times.lunch
  const hour = mealTimes[Math.floor(Math.random() * mealTimes.length)]
  const minute = Math.floor(Math.random() * 60).toString().padStart(2, '0')

  return `${hour}:${minute}`
}

function generateRecipeTags(): string[] {
  const allTags = [
    'high-protein', 'low-carb', 'vegetarian', 'vegan', 'gluten-free',
    'dairy-free', 'quick', 'meal-prep', 'healthy', 'comfort-food',
    'international', 'budget-friendly', 'one-pot', 'grilled', 'baked'
  ]

  const tagCount = Math.floor(Math.random() * 4) + 1
  const selectedTags = []

  for (let i = 0; i < tagCount; i++) {
    const tag = allTags[Math.floor(Math.random() * allTags.length)]
    if (!selectedTags.includes(tag)) {
      selectedTags.push(tag)
    }
  }

  return selectedTags
}