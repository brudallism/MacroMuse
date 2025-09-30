// ui/molecules/MealPlanningToolbar.tsx - Toolbar for meal planning actions
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { useTheme } from '../theme/ThemeProvider'

interface MealPlanningToolbarProps {
  onSave: () => void
  onApplyToLedger: () => void
  onGenerateShoppingList: () => void
  hasUnsavedChanges: boolean
  disabled?: boolean
}

export const MealPlanningToolbar: React.FC<MealPlanningToolbarProps> = ({
  onSave,
  onApplyToLedger,
  onGenerateShoppingList,
  hasUnsavedChanges,
  disabled = false
}) => {
  const theme = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.leftActions}>
        <Button
          title="Save Plan"
          onPress={onSave}
          variant={hasUnsavedChanges ? 'primary' : 'outline'}
          disabled={disabled}
          style={styles.button}
          icon={hasUnsavedChanges ? 'save' : 'check'}
        />
      </View>

      <View style={styles.rightActions}>
        <Button
          title="Shopping List"
          onPress={onGenerateShoppingList}
          variant="outline"
          disabled={disabled}
          style={styles.button}
          icon="shopping-cart"
        />

        <Button
          title="Apply to Log"
          onPress={onApplyToLedger}
          variant="secondary"
          disabled={disabled}
          style={styles.button}
          icon="calendar"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    marginHorizontal: 4,
  },
})