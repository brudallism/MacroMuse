// ui/molecules/ShoppingListModal.tsx - Shopping list modal for meal plans
import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert
} from 'react-native'

import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { ShoppingItem } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface ShoppingListModalProps {
  visible: boolean
  onClose: () => void
  shoppingItems: ShoppingItem[]
  planName: string
}

interface ShoppingItemCardProps {
  item: ShoppingItem
  onToggle: (checked: boolean) => void
  checked: boolean
}

const ShoppingItemCard: React.FC<ShoppingItemCardProps> = ({
  item,
  onToggle,
  checked
}) => {
  const theme = useTheme()

  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'meat-seafood': return '🥩'
      case 'dairy': return '🥛'
      case 'fruits': return '🍎'
      case 'vegetables': return '🥬'
      case 'grains': return '🌾'
      case 'condiments-spices': return '🧂'
      default: return '🛒'
    }
  }

  const formatAmount = (amount: number, unit: string): string => {
    // Round to reasonable precision
    if (amount % 1 === 0) {
      return `${amount} ${unit}`
    } else if (amount < 1) {
      return `${(amount * 100).toFixed(0)}% ${unit}`
    } else {
      return `${amount.toFixed(1)} ${unit}`
    }
  }

  return (
    <TouchableOpacity
      onPress={() => onToggle(!checked)}
      style={[
        styles.itemCard,
        checked && { opacity: 0.6 }
      ]}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.itemContent}>
          <View style={styles.itemLeft}>
            <View style={[
              styles.checkbox,
              { borderColor: theme.colors.border },
              checked && { backgroundColor: theme.colors.primary }
            ]}>
              {checked && (
                <Icon name="check" size={14} color={theme.colors.surface} />
              )}
            </View>
            <Text style={styles.categoryIcon}>
              {getCategoryIcon(item.category)}
            </Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={[
              styles.itemName,
              { color: theme.colors.text },
              checked && { textDecorationLine: 'line-through' }
            ]}>
              {item.name}
            </Text>
            <Text style={[styles.itemAmount, { color: theme.colors.textSecondary }]}>
              {formatAmount(item.amount, item.unit)}
            </Text>
            {item.recipeNames && item.recipeNames.length > 0 && (
              <Text style={[styles.recipeNames, { color: theme.colors.textSecondary }]}>
                For: {item.recipeNames.slice(0, 2).join(', ')}
                {item.recipeNames.length > 2 && ` +${item.recipeNames.length - 2} more`}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  )
}

export const ShoppingListModal: React.FC<ShoppingListModalProps> = ({
  visible,
  onClose,
  shoppingItems,
  planName
}) => {
  const theme = useTheme()
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const handleItemToggle = (itemName: string, checked: boolean) => {
    const newCheckedItems = new Set(checkedItems)
    if (checked) {
      newCheckedItems.add(itemName)
    } else {
      newCheckedItems.delete(itemName)
    }
    setCheckedItems(newCheckedItems)
  }

  const handleShare = async () => {
    try {
      const listText = generateShoppingListText()
      await Share.share({
        message: listText,
        title: `Shopping List - ${planName}`
      })
    } catch (error) {
      console.error('Error sharing shopping list:', error)
      Alert.alert('Error', 'Failed to share shopping list')
    }
  }

  const handleClearCompleted = () => {
    if (checkedItems.size === 0) return

    Alert.alert(
      'Clear Completed Items',
      `Remove ${checkedItems.size} completed items from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setCheckedItems(new Set())
          }
        }
      ]
    )
  }

  const generateShoppingListText = (): string => {
    const header = `Shopping List - ${planName}\n${'='.repeat(30)}\n\n`

    const groupedItems = groupItemsByCategory()
    let listText = header

    Object.entries(groupedItems).forEach(([category, items]) => {
      listText += `${category.toUpperCase()}\n`
      items.forEach(item => {
        const amount = item.amount % 1 === 0
          ? item.amount.toString()
          : item.amount.toFixed(1)
        listText += `□ ${item.name} - ${amount} ${item.unit}\n`
      })
      listText += '\n'
    })

    listText += `\nGenerated by MacroMuse\nTotal items: ${shoppingItems.length}`

    return listText
  }

  const groupItemsByCategory = (): Record<string, ShoppingItem[]> => {
    const grouped: Record<string, ShoppingItem[]> = {}

    shoppingItems.forEach(item => {
      const category = item.category || 'Other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(item)
    })

    // Sort categories
    const sortedGrouped: Record<string, ShoppingItem[]> = {}
    const categoryOrder = [
      'meat-seafood',
      'dairy',
      'fruits',
      'vegetables',
      'grains',
      'condiments-spices',
      'other'
    ]

    categoryOrder.forEach(category => {
      if (grouped[category]) {
        sortedGrouped[category] = grouped[category].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    // Add any remaining categories
    Object.keys(grouped).forEach(category => {
      if (!sortedGrouped[category]) {
        sortedGrouped[category] = grouped[category].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    return sortedGrouped
  }

  const formatCategoryName = (category: string): string => {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' & ')
  }

  const getCompletionStats = () => {
    const total = shoppingItems.length
    const completed = checkedItems.size
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
  }

  const stats = getCompletionStats()
  const groupedItems = groupItemsByCategory()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Shopping List
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {planName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleShare}>
              <Icon name="share" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: theme.colors.text }]}>
              {stats.completed} of {stats.total} completed ({stats.percentage}%)
            </Text>
            {stats.completed > 0 && (
              <Button
                title="Clear Completed"
                onPress={handleClearCompleted}
                variant="ghost"
                style={styles.clearButton}
              />
            )}
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${stats.percentage}%` }
              ]}
            />
          </View>
        </View>

        {/* Shopping List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {shoppingItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No shopping items found
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {Object.entries(groupedItems).map(([category, items]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={[styles.categoryHeader, { color: theme.colors.text }]}>
                    {formatCategoryName(category)} ({items.length})
                  </Text>
                  <View style={styles.categoryItems}>
                    {items.map((item, index) => (
                      <ShoppingItemCard
                        key={`${item.name}_${index}`}
                        item={item}
                        onToggle={(checked) => handleItemToggle(item.name, checked)}
                        checked={checkedItems.has(item.name)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Close"
            onPress={onClose}
            variant="outline"
            style={styles.footerButton}
          />
          <Button
            title="Share List"
            onPress={handleShare}
            variant="primary"
            style={styles.footerButton}
            icon="share"
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    paddingHorizontal: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryItems: {
    gap: 8,
  },
  itemCard: {
    // Card styling handled by Card component
  },
  card: {
    padding: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 18,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemAmount: {
    fontSize: 14,
    marginBottom: 2,
  },
  recipeNames: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
})