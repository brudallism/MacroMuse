import { useState, useEffect, useCallback, useMemo } from 'react'

interface FoodNutrients {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  saturated_fat_g?: number
}

interface FoodServingSize {
  amount: number
  unit: string
}

interface FoodItem {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'custom' | 'barcode'
  nutrients: FoodNutrients
  servingSize: FoodServingSize
  confidence?: number
  isFavorite?: boolean
}

type TabKey = 'search' | 'recent' | 'favorites' | 'custom'

interface SearchState {
  query: string
  results: FoodItem[]
  isLoading: boolean
  error: string | null
}

interface FoodSearchFacades {
  searchFacade: {
    search: (query: string) => Promise<{ results: FoodItem[]; error?: string }>
  }
  recentFoodsFacade: {
    getRecent: (userId: string) => Promise<FoodItem[]>
  }
  favoritesFacade: {
    getFavorites: (userId: string) => Promise<FoodItem[]>
    getCategories: (userId: string) => Promise<string[]>
    toggleFavorite: (userId: string, food: FoodItem) => Promise<boolean>
  }
  customFoodsFacade: {
    getCustom: (userId: string) => Promise<FoodItem[]>
    editCustom: (food: FoodItem) => Promise<void>
    deleteCustom: (foodId: string) => Promise<void>
  }
}

interface UseFoodSearchStateProps {
  userId: string
  initialSearchQuery?: string
  facades: FoodSearchFacades
}

export const useFoodSearchState = ({
  userId,
  initialSearchQuery = '',
  facades
}: UseFoodSearchStateProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('search')
  const [searchState, setSearchState] = useState<SearchState>({
    query: initialSearchQuery,
    results: [],
    isLoading: false,
    error: null
  })

  // Data for each tab
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([])
  const [favoriteFoods, setFavoriteFoods] = useState<FoodItem[]>([])
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([])
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([])
  const [selectedFavoriteCategory, setSelectedFavoriteCategory] = useState<string | undefined>()

  // Loading states
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
  const [isLoadingCustom, setIsLoadingCustom] = useState(false)

  // Selected food and portion adjustment
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [servingAmount, setServingAmount] = useState<number>(100)
  const [servingUnit, setServingUnit] = useState<string>('g')

  const loadRecentFoods = useCallback(async () => {
    setIsLoadingRecent(true)
    try {
      const foods = await facades.recentFoodsFacade.getRecent(userId)
      setRecentFoods(foods)
    } catch (error) {
      console.error('Error loading recent foods:', error)
    } finally {
      setIsLoadingRecent(false)
    }
  }, [userId, facades.recentFoodsFacade])

  const loadFavoriteFoods = useCallback(async () => {
    setIsLoadingFavorites(true)
    try {
      const foods = await facades.favoritesFacade.getFavorites(userId)
      setFavoriteFoods(foods)
    } catch (error) {
      console.error('Error loading favorite foods:', error)
    } finally {
      setIsLoadingFavorites(false)
    }
  }, [userId, facades.favoritesFacade])

  const loadCustomFoods = useCallback(async () => {
    setIsLoadingCustom(true)
    try {
      const foods = await facades.customFoodsFacade.getCustom(userId)
      setCustomFoods(foods)
    } catch (error) {
      console.error('Error loading custom foods:', error)
    } finally {
      setIsLoadingCustom(false)
    }
  }, [userId, facades.customFoodsFacade])

  const loadFavoriteCategories = useCallback(async () => {
    try {
      const categories = await facades.favoritesFacade.getCategories(userId)
      setFavoriteCategories(categories)
    } catch (error) {
      console.error('Error loading favorite categories:', error)
    }
  }, [userId, facades.favoritesFacade])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setSearchState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await facades.searchFacade.search(query)
      setSearchState(prev => ({
        ...prev,
        results: response.results,
        error: response.error || null,
        isLoading: false
      }))
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        results: [],
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false
      }))
    }
  }, [facades.searchFacade])

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchState(prev => ({ ...prev, query }))
    // Debouncing logic can be handled by the component
  }, [])

  const handleFoodPress = useCallback((food: FoodItem) => {
    setSelectedFood(food)
    setServingAmount(food.servingSize.amount)
    setServingUnit(food.servingSize.unit)
  }, [])

  const handleToggleFavorite = useCallback(async (food: FoodItem) => {
    try {
      const wasToggled = await facades.favoritesFacade.toggleFavorite(userId, food)
      if (wasToggled) {
        // Update local state
        if (activeTab === 'favorites') {
          loadFavoriteFoods()
        }
        // Update the food in search results if visible
        if (activeTab === 'search') {
          setSearchState(prev => ({
            ...prev,
            results: prev.results.map(f =>
              f.id === food.id ? { ...f, isFavorite: !f.isFavorite } : f
            )
          }))
        }
      }
    } catch (error) {
      console.error('Failed to update favorite status:', error)
      throw error
    }
  }, [userId, facades.favoritesFacade, activeTab, loadFavoriteFoods])

  const handleDeleteCustomFood = useCallback(async (food: FoodItem) => {
    try {
      await facades.customFoodsFacade.deleteCustom(food.id)
      loadCustomFoods()
    } catch (error) {
      console.error('Failed to delete food:', error)
      throw error
    }
  }, [facades.customFoodsFacade, loadCustomFoods])

  // Load initial data
  useEffect(() => {
    loadRecentFoods()
    loadFavoriteFoods()
    loadCustomFoods()
    loadFavoriteCategories()

    // Perform initial search if query provided
    if (initialSearchQuery) {
      performSearch(initialSearchQuery)
    }
  }, [userId, initialSearchQuery, loadRecentFoods, loadFavoriteFoods, loadCustomFoods, loadFavoriteCategories, performSearch])

  return {
    // State
    activeTab,
    setActiveTab,
    searchState,
    recentFoods,
    favoriteFoods,
    customFoods,
    favoriteCategories,
    selectedFavoriteCategory,
    setSelectedFavoriteCategory,
    isLoadingRecent,
    isLoadingFavorites,
    isLoadingCustom,
    selectedFood,
    setSelectedFood,
    servingAmount,
    setServingAmount,
    servingUnit,
    setServingUnit,

    // Actions
    performSearch,
    handleSearchQueryChange,
    handleFoodPress,
    handleToggleFavorite,
    handleDeleteCustomFood,
    loadRecentFoods,
    loadFavoriteFoods,
    loadCustomFoods,
    loadFavoriteCategories
  }
}