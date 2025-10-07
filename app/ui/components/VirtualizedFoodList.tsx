import React, { useMemo, useCallback, memo } from 'react'
import { View, StyleSheet, ListRenderItem, ViewToken } from 'react-native'
import { FlashList } from '@shopify/flash-list'

import { FoodCard } from '@ui/molecules/FoodCard'
import { LoadingSpinner } from '@ui/atoms/LoadingSpinner'
import { Text } from '@ui/atoms/Text'
import { useTheme } from '@ui/theme/ThemeProvider'
// Inline interfaces to avoid domain imports
interface FoodItem {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'custom' | 'barcode'
  nutrients: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
    sugar_g?: number
    sodium_mg?: number
    saturated_fat_g?: number
  }
  servingSize: {
    amount: number
    unit: string
  }
  confidence?: number
  isFavorite?: boolean
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
import { logger } from '@lib/logger'

export interface VirtualizedFoodListProps {
  foods: FoodItem[]
  variant?: 'search' | 'recent' | 'favorite' | 'custom' | 'barcode'
  loading?: boolean
  onFoodPress?: (food: FoodItem) => void
  onAddToLog?: (food: FoodItem) => void
  onToggleFavorite?: (food: FoodItem) => void
  onEdit?: (food: FoodItem) => void
  onDelete?: (food: FoodItem) => void
  selectedFoodId?: string
  currentMealType?: MealType
  servingAmount?: number
  servingUnit?: string
  onRefresh?: () => void
  refreshing?: boolean
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null
  emptyStateText?: string
  emptyStateAction?: React.ReactElement
  estimatedItemSize?: number
  maxItems?: number
  onViewableItemsChanged?: (info: { viewableItems: ViewToken[] }) => void
}

// Memoized food card to prevent unnecessary re-renders
const MemoizedFoodCard = memo<{
  food: FoodItem
  variant?: 'search' | 'recent' | 'favorite' | 'custom' | 'barcode'
  onFoodPress?: (food: FoodItem) => void
  onAddToLog?: (food: FoodItem) => void
  onToggleFavorite?: (food: FoodItem) => void
  onEdit?: (food: FoodItem) => void
  onDelete?: (food: FoodItem) => void
  isSelected?: boolean
  currentMealType?: MealType
  servingAmount?: number
  servingUnit?: string
}>(({
  food,
  variant,
  onFoodPress,
  onAddToLog,
  onToggleFavorite,
  onEdit,
  onDelete,
  isSelected,
  currentMealType,
  servingAmount,
  servingUnit
}) => (
  <FoodCard
    food={food}
    variant={variant}
    showMealSuitability={!!currentMealType}
    currentMealType={currentMealType}
    onPress={onFoodPress}
    onAddToLog={onAddToLog}
    onToggleFavorite={onToggleFavorite}
    onEdit={onEdit}
    onDelete={onDelete}
    isSelected={isSelected}
    servingAmount={isSelected ? servingAmount : undefined}
    servingUnit={isSelected ? servingUnit : undefined}
  />
), (prevProps, nextProps) => {
  // Custom equality check for better performance
  return (
    prevProps.food.id === nextProps.food.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.servingAmount === nextProps.servingAmount &&
    prevProps.servingUnit === nextProps.servingUnit &&
    prevProps.food.isFavorite === nextProps.food.isFavorite &&
    prevProps.currentMealType === nextProps.currentMealType
  )
})

export const VirtualizedFoodList: React.FC<VirtualizedFoodListProps> = ({
  foods,
  variant = 'search',
  loading = false,
  onFoodPress,
  onAddToLog,
  onToggleFavorite,
  onEdit,
  onDelete,
  selectedFoodId,
  currentMealType,
  servingAmount,
  servingUnit,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListFooterComponent,
  emptyStateText = 'No foods found',
  emptyStateAction,
  estimatedItemSize = 120,
  maxItems = 1000,
  onViewableItemsChanged
}) => {
  const theme = useTheme()

  // Limit items for performance (large lists can cause memory issues)
  const limitedFoods = useMemo(() => {
    return foods.slice(0, maxItems)
  }, [foods, maxItems])

  // Optimized render function
  const renderItem: ListRenderItem<FoodItem> = useCallback(({ item }) => {
    return (
      <MemoizedFoodCard
        food={item}
        variant={variant}
        onFoodPress={onFoodPress}
        onAddToLog={onAddToLog}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onDelete={onDelete}
        isSelected={selectedFoodId === item.id}
        currentMealType={currentMealType}
        servingAmount={servingAmount}
        servingUnit={servingUnit}
      />
    )
  }, [
    variant,
    onFoodPress,
    onAddToLog,
    onToggleFavorite,
    onEdit,
    onDelete,
    selectedFoodId,
    currentMealType,
    servingAmount,
    servingUnit
  ])

  // Key extractor for efficient list updates
  const keyExtractor = useCallback((item: FoodItem) => item.id, [])

  // Get item layout for better performance (if items have consistent height)
  const getItemLayout = useCallback((data: FoodItem[] | null | undefined, index: number) => ({
    length: estimatedItemSize,
    offset: estimatedItemSize * index,
    index
  }), [estimatedItemSize])

  // Empty state component
  const EmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading foods...
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          {emptyStateText}
        </Text>
        {emptyStateAction}
      </View>
    )
  }, [loading, emptyStateText, emptyStateAction, theme.colors.textSecondary])

  // Footer component with loading indicator for pagination
  const FooterComponent = useMemo(() => {
    if (ListFooterComponent) {
      return ListFooterComponent
    }

    if (limitedFoods.length === maxItems && foods.length > maxItems) {
      return (
        <View style={styles.paginationFooter}>
          <Text style={[styles.paginationText, { color: theme.colors.textSecondary }]}>
            Showing {maxItems} of {foods.length} results
          </Text>
          <Text style={[styles.paginationHint, { color: theme.colors.textSecondary }]}>
            Refine your search to see more specific results
          </Text>
        </View>
      )
    }

    return null
  }, [ListFooterComponent, limitedFoods.length, maxItems, foods.length, theme.colors.textSecondary])

  // Performance monitoring
  const onScrollBeginDrag = useCallback(() => {
    logger.debug('Food list scroll started', { itemCount: limitedFoods.length })
  }, [limitedFoods.length])

  const onMomentumScrollEnd = useCallback(() => {
    logger.debug('Food list scroll ended')
  }, [])

  // Track viewable items for analytics
  const handleViewableItemsChanged = useCallback((info: { viewableItems: ViewToken[] }) => {
    onViewableItemsChanged?.(info)

    // Log viewable items for analytics
    const viewableIds = info.viewableItems.map(item => item.item?.id).filter(Boolean)
    if (viewableIds.length > 0) {
      logger.debug('Viewable food items changed', {
        viewableCount: viewableIds.length,
        firstVisible: viewableIds[0],
        lastVisible: viewableIds[viewableIds.length - 1]
      })
    }
  }, [onViewableItemsChanged])

  // Performance optimization: only update viewable items every 500ms
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
    waitForInteraction: false
  }), [])

  if (loading && limitedFoods.length === 0) {
    return EmptyComponent
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={limitedFoods}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={estimatedItemSize}
        getItemLayout={limitedFoods.length < 100 ? getItemLayout : undefined}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={FooterComponent}
        ListEmptyComponent={EmptyComponent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        updateCellsBatchingPeriod={100}
        disableIntervalMomentum={true}
        // FlashList specific optimizations
        drawDistance={200}
        extraData={{
          selectedFoodId,
          servingAmount,
          servingUnit,
          currentMealType
        }}
      />
    </View>
  )
}

// Additional performance utilities
export const useFoodListOptimizations = () => {
  // Debounced search function
  const debouncedSearch = useCallback((searchFn: (query: string) => void, delay: number = 300) => {
    let timeoutId: ReturnType<typeof setTimeout>

    return (query: string) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => searchFn(query), delay)
    }
  }, [])

  // Memoized filter function
  const createMemoizedFilter = useCallback((filterFn: (foods: FoodItem[]) => FoodItem[]) => {
    let lastFoods: FoodItem[]
    let lastResult: FoodItem[]

    return (foods: FoodItem[]) => {
      if (foods === lastFoods) {
        return lastResult
      }

      lastFoods = foods
      lastResult = filterFn(foods)
      return lastResult
    }
  }, [])

  // Batch update function for frequent state changes
  const batchUpdates = useCallback((updates: Array<() => void>) => {
    updates.forEach(update => update())
  }, [])

  return {
    debouncedSearch,
    createMemoizedFilter,
    batchUpdates
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  paginationFooter: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  paginationHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
})