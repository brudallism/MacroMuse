// ui/molecules/AddMealModal.tsx - Modal for adding meals to plan
import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput
} from 'react-native'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { LoadingSpinner } from '../atoms/LoadingSpinner'
import { TabView } from './TabView'
import { FoodCard } from './FoodCard'
import { RecipeData, FoodItem } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface AddMealModalProps {
  visible: boolean
  onClose: () => void
  onAddMeal: (item: RecipeData | FoodItem) => void
  recipes: RecipeData[]
  foods: FoodItem[]
  mealType: string
  dayName: string
}

export const AddMealModal: React.FC<AddMealModalProps> = ({
  visible,
  onClose,
  onAddMeal,
  recipes,
  foods,
  mealType,
  dayName
}) => {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<'recipes' | 'foods' | 'recent'>('recipes')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredRecipes, setFilteredRecipes] = useState<RecipeData[]>(recipes)
  const [filteredFoods, setFilteredFoods] = useState<FoodItem[]>(foods)

  // Filter items based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRecipes(recipes)
      setFilteredFoods(foods)
      return
    }

    const query = searchQuery.toLowerCase()

    const matchingRecipes = recipes.filter(recipe =>
      recipe.name.toLowerCase().includes(query) ||
      recipe.tags.some(tag => tag.toLowerCase().includes(query)) ||
      recipe.ingredients.some(ing => ing.name.toLowerCase().includes(query))
    )

    const matchingFoods = foods.filter(food =>
      food.name.toLowerCase().includes(query) ||
      (food.brand && food.brand.toLowerCase().includes(query))
    )

    setFilteredRecipes(matchingRecipes)
    setFilteredFoods(matchingFoods)
  }, [searchQuery, recipes, foods])

  const handleItemSelect = (item: RecipeData | FoodItem) => {
    onAddMeal(item)
    onClose()
  }

  const getRecentItems = (): (RecipeData | FoodItem)[] => {
    // In a real implementation, this would fetch recent/favorite items from storage
    const allItems = [...recipes, ...foods]
    return allItems.slice(0, 10) // Show first 10 as "recent"
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'recipes':
        return (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {searchQuery ? 'No recipes found matching your search' : 'No recipes available'}
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {filteredRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    onPress={() => handleItemSelect(recipe)}
                    style={styles.itemCard}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.recipeIcon}>📝</Text>
                        <View style={styles.cardContent}>
                          <Text style={[styles.itemName, { color: theme.colors.text }]}>
                            {recipe.name}
                          </Text>
                          <Text style={[styles.itemDetails, { color: theme.colors.textSecondary }]}>
                            {recipe.servings} servings • {recipe.difficulty}
                          </Text>
                          {recipe.tags.length > 0 && (
                            <View style={styles.tags}>
                              {recipe.tags.slice(0, 3).map((tag, index) => (
                                <View key={index} style={[styles.tag, { backgroundColor: theme.colors.primary + '20' }]}>
                                  <Text style={[styles.tagText, { color: theme.colors.primary }]}>
                                    {tag}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Icon name="plus" size={20} color={theme.colors.primary} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )

      case 'foods':
        return (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {filteredFoods.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {searchQuery ? 'No foods found matching your search' : 'No foods available'}
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {filteredFoods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    onPress={() => handleItemSelect(food)}
                    style={styles.itemCard}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.foodIcon}>🥗</Text>
                        <View style={styles.cardContent}>
                          <Text style={[styles.itemName, { color: theme.colors.text }]}>
                            {food.name}
                          </Text>
                          <Text style={[styles.itemDetails, { color: theme.colors.textSecondary }]}>
                            {food.servingSize.amount} {food.servingSize.unit}
                            {food.brand && ` • ${food.brand}`}
                          </Text>
                        </View>
                        <Icon name="plus" size={20} color={theme.colors.primary} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )

      case 'recent':
        const recentItems = getRecentItems()
        return (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {recentItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No recent items
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {recentItems.map((item) => {
                  const isRecipe = 'ingredients' in item
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleItemSelect(item)}
                      style={styles.itemCard}
                    >
                      <Card style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.recipeIcon}>
                            {isRecipe ? '📝' : '🥗'}
                          </Text>
                          <View style={styles.cardContent}>
                            <Text style={[styles.itemName, { color: theme.colors.text }]}>
                              {item.name}
                            </Text>
                            <Text style={[styles.itemDetails, { color: theme.colors.textSecondary }]}>
                              {isRecipe ? 'Recipe' : 'Food'}
                            </Text>
                          </View>
                          <Icon name="plus" size={20} color={theme.colors.primary} />
                        </View>
                      </Card>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </ScrollView>
        )
    }
  }

  const tabs = [
    { id: 'recipes', label: 'Recipes', count: filteredRecipes.length },
    { id: 'foods', label: 'Foods', count: filteredFoods.length },
    { id: 'recent', label: 'Recent', count: getRecentItems().length }
  ]

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
              Add {mealType}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {dayName}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: theme.colors.surface }]}>
            <Icon name="search" size={20} color={theme.colors.textSecondary} />
            <RNTextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search recipes and foods..."
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <TabView
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as 'recipes' | 'foods' | 'recent')}
        />

        {/* Content */}
        {renderContent()}
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
  itemsList: {
    padding: 16,
    gap: 8,
  },
  itemCard: {
    // Card styling handled by Card component
  },
  card: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  foodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    marginBottom: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
})