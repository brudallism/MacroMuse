// ui/organisms/RecipeForm.tsx - THE unified component for Recipe Builder ≡ Display
// Critical Foundation.md requirement: Same component handles create/edit/display
import React, { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { Button } from '../atoms/Button'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { TextInput } from '../atoms/TextInput'
import { RecipeData, RecipeIngredient, RecipeStep, NutrientVector } from '../../domain/models'
import {
  calculateRecipeNutrients,
  validateRecipe,
  getEmptyRecipe,
  scaleRecipeNutrients
} from '../../domain/services/recipes'
import { RecipeBasicInfo } from '../molecules/RecipeBasicInfo'
import { RecipeIngredientsList } from '../molecules/RecipeIngredientsList'
import { RecipeInstructionsList } from '../molecules/RecipeInstructionsList'
import { RecipeNutritionSummary } from '../molecules/RecipeNutritionSummary'
import { useTheme } from '../theme/ThemeProvider'

export interface RecipeFormProps {
  mode: 'create' | 'edit' | 'display'
  initialData?: RecipeData
  onSave?: (recipe: RecipeData) => void
  onCancel?: () => void
  onDelete?: (recipeId: string) => void
  readonly?: boolean
  userId: string
}

export const RecipeForm: React.FC<RecipeFormProps> = ({
  mode,
  initialData,
  onSave,
  onCancel,
  onDelete,
  readonly = false,
  userId
}) => {
  const theme = useTheme()
  const [recipe, setRecipe] = useState<RecipeData>(() =>
    initialData || { ...getEmptyRecipe(userId), id: undefined }
  )
  const [isCalculating, setIsCalculating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Determine if component is in readonly mode
  const isReadonly = readonly || mode === 'display'

  // Recalculate nutrition when ingredients change
  useEffect(() => {
    if (!isReadonly && recipe.ingredients.length > 0) {
      setIsCalculating(true)
      try {
        const nutrients = calculateRecipeNutrients(recipe.ingredients)
        setRecipe(prev => ({ ...prev, nutrients }))
      } catch (error) {
        console.error('Error calculating recipe nutrients:', error)
      } finally {
        setIsCalculating(false)
      }
    }
  }, [recipe.ingredients, isReadonly])

  const updateRecipe = useCallback((updates: Partial<RecipeData>) => {
    if (isReadonly) return
    setRecipe(prev => ({ ...prev, ...updates }))
    setValidationErrors([]) // Clear errors when user makes changes
  }, [isReadonly])

  const updateIngredients = useCallback((ingredients: RecipeIngredient[]) => {
    updateRecipe({ ingredients })
  }, [updateRecipe])

  const updateInstructions = useCallback((instructions: RecipeStep[]) => {
    updateRecipe({ instructions })
  }, [updateRecipe])

  const handleSave = useCallback(() => {
    const errors = validateRecipe(recipe)
    if (errors.length > 0) {
      setValidationErrors(errors)
      Alert.alert('Validation Error', errors.join('\n'))
      return
    }

    setValidationErrors([])
    onSave?.(recipe)
  }, [recipe, onSave])

  const handleDelete = useCallback(() => {
    if (!recipe.id) return

    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(recipe.id!)
        }
      ]
    )
  }, [recipe.id, onDelete])

  const handleScale = useCallback((newServings: number) => {
    if (isReadonly || newServings <= 0) return

    try {
      // Scale ingredients proportionally
      const scaleFactor = newServings / recipe.servings
      const scaledIngredients = recipe.ingredients.map(ingredient => ({
        ...ingredient,
        amount: Math.round(ingredient.amount * scaleFactor * 100) / 100
      }))

      // Scale nutrition
      const scaledNutrients = scaleRecipeNutrients(
        recipe.nutrients,
        recipe.servings,
        newServings
      )

      updateRecipe({
        servings: newServings,
        ingredients: scaledIngredients,
        nutrients: scaledNutrients
      })
    } catch (error) {
      console.error('Error scaling recipe:', error)
      Alert.alert('Error', 'Failed to scale recipe. Please try again.')
    }
  }, [recipe.servings, recipe.ingredients, recipe.nutrients, isReadonly, updateRecipe])

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card style={[styles.errorCard, { backgroundColor: theme.colors.error + '20' }]}>
          <Text style={[styles.errorTitle, { color: theme.colors.error }]}>
            Please fix the following errors:
          </Text>
          {validationErrors.map((error, index) => (
            <Text key={index} style={[styles.errorText, { color: theme.colors.error }]}>
              • {error}
            </Text>
          ))}
        </Card>
      )}

      {/* Basic Recipe Information */}
      <RecipeBasicInfo
        data={recipe}
        onChange={isReadonly ? undefined : updateRecipe}
        readonly={isReadonly}
        onScale={handleScale}
      />

      {/* Ingredients List */}
      <RecipeIngredientsList
        ingredients={recipe.ingredients}
        onChange={isReadonly ? undefined : updateIngredients}
        readonly={isReadonly}
        servings={recipe.servings}
      />

      {/* Instructions List */}
      <RecipeInstructionsList
        instructions={recipe.instructions}
        onChange={isReadonly ? undefined : updateInstructions}
        readonly={isReadonly}
      />

      {/* Nutrition Summary */}
      <RecipeNutritionSummary
        nutrients={recipe.nutrients}
        servings={recipe.servings}
        isCalculating={isCalculating}
      />

      {/* Action Buttons */}
      {!isReadonly && (
        <RecipeFormActions
          mode={mode}
          onSave={handleSave}
          onCancel={onCancel}
          onDelete={recipe.id ? handleDelete : undefined}
          hasChanges={JSON.stringify(recipe) !== JSON.stringify(initialData)}
        />
      )}

      {/* Display-only mode can show additional info */}
      {mode === 'display' && recipe.source === 'spoonacular' && (
        <Card style={styles.sourceCard}>
          <Text style={[styles.sourceText, { color: theme.colors.textSecondary }]}>
            Imported from Spoonacular
          </Text>
        </Card>
      )}
    </ScrollView>
  )
}

interface RecipeFormActionsProps {
  mode: 'create' | 'edit' | 'display'
  onSave: () => void
  onCancel?: () => void
  onDelete?: () => void
  hasChanges: boolean
}

const RecipeFormActions: React.FC<RecipeFormActionsProps> = ({
  mode,
  onSave,
  onCancel,
  onDelete,
  hasChanges
}) => {
  const theme = useTheme()

  return (
    <View style={styles.actionsContainer}>
      <View style={styles.actionRow}>
        {onCancel && (
          <Button
            title="Cancel"
            onPress={onCancel}
            variant="outline"
            style={styles.actionButton}
          />
        )}

        <Button
          title={mode === 'create' ? 'Create Recipe' : 'Save Changes'}
          onPress={onSave}
          variant="primary"
          style={[styles.actionButton, styles.primaryAction]}
          disabled={!hasChanges && mode === 'edit'}
        />
      </View>

      {onDelete && (
        <Button
          title="Delete Recipe"
          onPress={onDelete}
          variant="destructive"
          style={[styles.actionButton, styles.deleteAction]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  errorCard: {
    marginBottom: 16,
    padding: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 4,
  },
  sourceCard: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  actionsContainer: {
    marginTop: 24,
    marginBottom: 32,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  primaryAction: {
    // Primary button styling handled by Button component
  },
  deleteAction: {
    marginTop: 8,
  },
})

export default RecipeForm