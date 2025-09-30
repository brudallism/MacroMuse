// ui/molecules/RecipeInstructionsList.tsx - Recipe instructions management component
import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { TextInput } from '../atoms/TextInput'
import { Button } from '../atoms/Button'
import { RecipeStep } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface RecipeInstructionsListProps {
  instructions: RecipeStep[]
  onChange?: (instructions: RecipeStep[]) => void
  readonly?: boolean
}

export const RecipeInstructionsList: React.FC<RecipeInstructionsListProps> = ({
  instructions,
  onChange,
  readonly = false
}) => {
  const theme = useTheme()
  const [editingId, setEditingId] = useState<string | null>(null)

  const addInstruction = () => {
    if (readonly || !onChange) return

    const newInstruction: RecipeStep = {
      id: `instruction_${Date.now()}`,
      order: instructions.length + 1,
      instruction: '',
      duration: undefined
    }

    onChange([...instructions, newInstruction])
    setEditingId(newInstruction.id!)
  }

  const updateInstruction = (id: string, updates: Partial<RecipeStep>) => {
    if (readonly || !onChange) return

    const updatedInstructions = instructions.map(instruction =>
      instruction.id === id ? { ...instruction, ...updates } : instruction
    )
    onChange(updatedInstructions)
  }

  const removeInstruction = (id: string) => {
    if (readonly || !onChange) return

    Alert.alert(
      'Remove Instruction',
      'Are you sure you want to remove this instruction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const filteredInstructions = instructions
              .filter(instruction => instruction.id !== id)
              .map((instruction, index) => ({
                ...instruction,
                order: index + 1
              }))
            onChange(filteredInstructions)
            if (editingId === id) {
              setEditingId(null)
            }
          }
        }
      ]
    )
  }

  const moveInstruction = (fromIndex: number, toIndex: number) => {
    if (readonly || !onChange) return

    const reorderedInstructions = [...instructions]
    const [movedItem] = reorderedInstructions.splice(fromIndex, 1)
    reorderedInstructions.splice(toIndex, 0, movedItem)

    // Update order numbers
    const updatedInstructions = reorderedInstructions.map((instruction, index) => ({
      ...instruction,
      order: index + 1
    }))

    onChange(updatedInstructions)
  }

  const getTotalCookingTime = () => {
    return instructions.reduce((total, instruction) => {
      return total + (instruction.duration || 0)
    }, 0)
  }

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Instructions ({instructions.length})
        </Text>
        {!readonly && (
          <Button
            title="Add Step"
            onPress={addInstruction}
            variant="outline"
            style={styles.addButton}
          />
        )}
      </View>

      {instructions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {readonly ? 'No instructions provided' : 'No instructions yet. Add your first step!'}
          </Text>
        </View>
      ) : (
        <View style={styles.instructionsList}>
          {instructions
            .sort((a, b) => a.order - b.order)
            .map((instruction, index) => (
              <InstructionRow
                key={instruction.id || index}
                instruction={instruction}
                index={index}
                isEditing={editingId === instruction.id}
                onEdit={() => setEditingId(instruction.id || null)}
                onSave={() => setEditingId(null)}
                onUpdate={(updates) => updateInstruction(instruction.id!, updates)}
                onRemove={() => removeInstruction(instruction.id!)}
                onMoveUp={index > 0 ? () => moveInstruction(index, index - 1) : undefined}
                onMoveDown={index < instructions.length - 1 ? () => moveInstruction(index, index + 1) : undefined}
                readonly={readonly}
              />
            ))}
        </View>
      )}

      {instructions.length > 0 && getTotalCookingTime() > 0 && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Total cooking time: {getTotalCookingTime()} minutes
          </Text>
        </View>
      )}
    </Card>
  )
}

interface InstructionRowProps {
  instruction: RecipeStep
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onUpdate: (updates: Partial<RecipeStep>) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  readonly: boolean
}

const InstructionRow: React.FC<InstructionRowProps> = ({
  instruction,
  index,
  isEditing,
  onEdit,
  onSave,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  readonly
}) => {
  const theme = useTheme()
  const [tempValues, setTempValues] = useState({
    instruction: instruction.instruction,
    duration: instruction.duration?.toString() || ''
  })

  const handleSave = () => {
    if (!tempValues.instruction.trim()) {
      Alert.alert('Missing Instruction', 'Please enter the instruction text.')
      return
    }

    const duration = tempValues.duration ? parseInt(tempValues.duration) : undefined

    onUpdate({
      instruction: tempValues.instruction.trim(),
      duration: duration && duration > 0 ? duration : undefined
    })
    onSave()
  }

  const handleCancel = () => {
    setTempValues({
      instruction: instruction.instruction,
      duration: instruction.duration?.toString() || ''
    })
    onSave()
  }

  if (readonly) {
    return (
      <View style={[styles.instructionRow, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.stepNumber}>
          <Text style={[styles.stepNumberText, { color: theme.colors.primary }]}>
            {instruction.order}
          </Text>
        </View>
        <View style={styles.instructionContent}>
          <Text style={[styles.instructionText, { color: theme.colors.text }]}>
            {instruction.instruction}
          </Text>
          {instruction.duration && (
            <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
              {instruction.duration} min
            </Text>
          )}
        </View>
      </View>
    )
  }

  if (isEditing) {
    return (
      <View style={[styles.instructionRow, styles.editingRow, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.stepNumber}>
          <Text style={[styles.stepNumberText, { color: theme.colors.primary }]}>
            {instruction.order}
          </Text>
        </View>
        <View style={styles.editForm}>
          <TextInput
            value={tempValues.instruction}
            onChangeText={(value) => setTempValues(prev => ({ ...prev, instruction: value }))}
            placeholder="Enter instruction step..."
            multiline
            numberOfLines={3}
            style={[styles.instructionInput, { backgroundColor: theme.colors.background }]}
          />
          <View style={styles.editRow}>
            <TextInput
              value={tempValues.duration}
              onChangeText={(value) => setTempValues(prev => ({ ...prev, duration: value }))}
              placeholder="Duration (min)"
              keyboardType="numeric"
              style={[styles.durationInput, { backgroundColor: theme.colors.background }]}
            />
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
      </View>
    )
  }

  return (
    <View style={[styles.instructionRow, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.stepNumber}>
        <Text style={[styles.stepNumberText, { color: theme.colors.primary }]}>
          {instruction.order}
        </Text>
      </View>
      <View style={styles.instructionContent}>
        <Text style={[styles.instructionText, { color: theme.colors.text }]}>
          {instruction.instruction}
        </Text>
        {instruction.duration && (
          <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
            {instruction.duration} min
          </Text>
        )}
      </View>
      <View style={styles.instructionActions}>
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
  instructionsList: {
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    minHeight: 60,
  },
  editingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionContent: {
    flex: 1,
    marginRight: 8,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  durationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  instructionActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  moveButton: {
    minWidth: 32,
    marginHorizontal: 2,
  },
  actionButton: {
    marginHorizontal: 4,
  },
  editForm: {
    flex: 1,
    gap: 12,
  },
  instructionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationInput: {
    flex: 1,
    maxWidth: 120,
  },
  editActions: {
    flexDirection: 'row',
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