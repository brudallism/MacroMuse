// ui/molecules/RecipeIngredientsList.tsx - Recipe ingredients management component
import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'

import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { TextInput } from '../atoms/TextInput'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { RecipeIngredient, NutrientVector } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface RecipeIngredientsListProps {
  ingredients: RecipeIngredient[]
  onChange?: (ingredients: RecipeIngredient[]) => void
  readonly?: boolean
  servings: number
}

export const RecipeIngredientsList: React.FC<RecipeIngredientsListProps> = ({
  ingredients,
  onChange,
  readonly = false,
  servings
}) => {
  const theme = useTheme()
  const [editingId, setEditingId] = useState<string | null>(null)

  const addIngredient = () => {
    if (readonly || !onChange) return

    const newIngredient: RecipeIngredient = {
      id: `ingredient_${Date.now()}`,
      name: '',
      amount: 1,
      unit: 'cup',
      nutrients: {},
      orderIndex: ingredients.length
    }

    onChange([...ingredients, newIngredient])
    setEditingId(newIngredient.id!)
  }

  const updateIngredient = (id: string, updates: Partial<RecipeIngredient>) => {
    if (readonly || !onChange) return

    const updatedIngredients = ingredients.map(ingredient =>
      ingredient.id === id ? { ...ingredient, ...updates } : ingredient
    )
    onChange(updatedIngredients)
  }

  const removeIngredient = (id: string) => {
    if (readonly || !onChange) return

    Alert.alert(
      'Remove Ingredient',
      'Are you sure you want to remove this ingredient?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const filteredIngredients = ingredients.filter(ingredient => ingredient.id !== id)
            onChange(filteredIngredients)
            if (editingId === id) {
              setEditingId(null)
            }
          }
        }
      ]
    )
  }

  const moveIngredient = (fromIndex: number, toIndex: number) => {
    if (readonly || !onChange) return

    const reorderedIngredients = [...ingredients]
    const [movedItem] = reorderedIngredients.splice(fromIndex, 1)
    reorderedIngredients.splice(toIndex, 0, movedItem)

    // Update order indices
    const updatedIngredients = reorderedIngredients.map((ingredient, index) => ({
      ...ingredient,
      orderIndex: index
    }))

    onChange(updatedIngredients)
  }

  const commonUnits = [
    'cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l',
    'piece', 'slice', 'clove', 'can', 'package', 'bunch'
  ]

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Ingredients ({ingredients.length})
        </Text>
        {!readonly && (
          <Button
            title="Add Ingredient"
            onPress={addIngredient}
            variant="outline"
            style={styles.addButton}
          />
        )}
      </View>

      {ingredients.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {readonly ? 'No ingredients listed' : 'No ingredients yet. Add your first ingredient!'}
          </Text>
        </View>
      ) : (
        <View style={styles.ingredientsList}>
          {ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id || index}
              ingredient={ingredient}
              index={index}
              isEditing={editingId === ingredient.id}
              onEdit={() => setEditingId(ingredient.id || null)}
              onSave={() => setEditingId(null)}
              onUpdate={(updates) => updateIngredient(ingredient.id!, updates)}
              onRemove={() => removeIngredient(ingredient.id!)}
              onMoveUp={index > 0 ? () => moveIngredient(index, index - 1) : undefined}
              onMoveDown={index < ingredients.length - 1 ? () => moveIngredient(index, index + 1) : undefined}
              readonly={readonly}
              commonUnits={commonUnits}
              servings={servings}
            />
          ))}
        </View>
      )}

      {ingredients.length > 0 && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Recipe serves {servings} {servings === 1 ? 'person' : 'people'}
          </Text>
        </View>
      )}
    </Card>
  )
}

interface IngredientRowProps {
  ingredient: RecipeIngredient
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onUpdate: (updates: Partial<RecipeIngredient>) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  readonly: boolean
  commonUnits: string[]
  servings: number
}

const IngredientRow: React.FC<IngredientRowProps> = ({
  ingredient,
  index,
  isEditing,
  onEdit,
  onSave,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  readonly,
  commonUnits,
  servings
}) => {
  const theme = useTheme()
  const [tempValues, setTempValues] = useState({
    name: ingredient.name,
    amount: ingredient.amount.toString(),
    unit: ingredient.unit
  })

  const handleSave = () => {
    const amount = parseFloat(tempValues.amount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for the amount.')
      return
    }

    if (!tempValues.name.trim()) {
      Alert.alert('Missing Name', 'Please enter an ingredient name.')
      return
    }

    onUpdate({
      name: tempValues.name.trim(),
      amount,
      unit: tempValues.unit
    })
    onSave()
  }

  const handleCancel = () => {
    setTempValues({
      name: ingredient.name,
      amount: ingredient.amount.toString(),
      unit: ingredient.unit
    })
    onSave()
  }

  if (readonly) {
    return (
      <View style={[styles.ingredientRow, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.ingredientContent}>
          <Text style={[styles.ingredientIndex, { color: theme.colors.textSecondary }]}>
            {index + 1}.
          </Text>
          <Text style={[styles.ingredientText, { color: theme.colors.text }]}>
            {ingredient.amount} {ingredient.unit} {ingredient.name}
          </Text>
        </View>
      </View>
    )
  }

  if (isEditing) {
    return (
      <View style={[styles.ingredientRow, styles.editingRow, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.editForm}>
          <View style={styles.editRow}>
            <TextInput
              value={tempValues.amount}
              onChangeText={(value) => setTempValues(prev => ({ ...prev, amount: value }))}
              placeholder="1"
              keyboardType="numeric"
              style={[styles.amountInput, { backgroundColor: theme.colors.background }]}
            />
            <TextInput
              value={tempValues.unit}
              onChangeText={(value) => setTempValues(prev => ({ ...prev, unit: value }))}
              placeholder="unit"
              style={[styles.unitInput, { backgroundColor: theme.colors.background }]}
            />
            <TextInput
              value={tempValues.name}
              onChangeText={(value) => setTempValues(prev => ({ ...prev, name: value }))}
              placeholder="Ingredient name"
              style={[styles.nameInput, { backgroundColor: theme.colors.background }]}
            />
          </View>
          <View style={styles.editActions}>
            <Button
              title="Cancel"
              onPress={handleCancel}
              variant="outline"
              style={styles.editButton}
            />
            <Button
              title="Save"
              onPress={handleSave}
              variant="primary"
              style={styles.editButton}
            />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.ingredientRow, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.ingredientContent}>
        <Text style={[styles.ingredientIndex, { color: theme.colors.textSecondary }]}>
          {index + 1}.
        </Text>
        <Text style={[styles.ingredientText, { color: theme.colors.text }]}>
          {ingredient.amount} {ingredient.unit} {ingredient.name}
        </Text>
      </View>
      <View style={styles.ingredientActions}>
        {onMoveUp && (
          <Button
            title="↑"
            onPress={onMoveUp}
            variant="ghost"
            style={styles.moveButton}
          />
        )}
        {onMoveDown && (
          <Button
            title="↓"
            onPress={onMoveDown}
            variant="ghost"
            style={styles.moveButton}
          />
        )}
        <Button
          title="Edit"
          onPress={onEdit}
          variant="ghost"
          style={styles.actionButton}
        />
        <Button
          title="Remove"
          onPress={onRemove}
          variant="ghost"
          style={[styles.actionButton, { color: theme.colors.error }]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    minHeight: 48,
  },
  editingRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  ingredientContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientIndex: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
  },
  ingredientText: {
    fontSize: 16,
    flex: 1,
  },
  ingredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moveButton: {
    minWidth: 32,
    marginHorizontal: 2,
  },
  actionButton: {
    marginHorizontal: 4,
  },
  editForm: {
    gap: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  amountInput: {
    flex: 1,
    minWidth: 60,
  },
  unitInput: {
    flex: 1,
    minWidth: 80,
  },
  nameInput: {
    flex: 3,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 16,
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
})