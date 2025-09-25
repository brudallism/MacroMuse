// state/uiStore.ts - ephemeral UI (NO cross-store imports)
import { create } from 'zustand'

interface UIState {
  // Modal states
  isSearchModalOpen: boolean
  isSettingsModalOpen: boolean
  isInsightsModalOpen: boolean

  // Loading states
  isSearching: boolean
  isLoggingMeal: boolean
  isLoadingTotals: boolean

  // Search state
  searchQuery: string
  searchFocused: boolean

  // Toast notifications
  toasts: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    duration?: number
  }>

  // Actions
  setSearchModalOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  setInsightsModalOpen: (open: boolean) => void
  setSearching: (loading: boolean) => void
  setLoggingMeal: (loading: boolean) => void
  setLoadingTotals: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setSearchFocused: (focused: boolean) => void
  addToast: (
    message: string,
    type?: 'success' | 'error' | 'info' | 'warning',
    duration?: number
  ) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // State
  isSearchModalOpen: false,
  isSettingsModalOpen: false,
  isInsightsModalOpen: false,
  isSearching: false,
  isLoggingMeal: false,
  isLoadingTotals: false,
  searchQuery: '',
  searchFocused: false,
  toasts: [],

  // Actions
  setSearchModalOpen: (open): void => set({ isSearchModalOpen: open }),
  setSettingsModalOpen: (open): void => set({ isSettingsModalOpen: open }),
  setInsightsModalOpen: (open): void => set({ isInsightsModalOpen: open }),
  setSearching: (loading): void => set({ isSearching: loading }),
  setLoggingMeal: (loading): void => set({ isLoggingMeal: loading }),
  setLoadingTotals: (loading): void => set({ isLoadingTotals: loading }),
  setSearchQuery: (query): void => set({ searchQuery: query }),
  setSearchFocused: (focused): void => set({ searchFocused: focused }),

  addToast: (message, type = 'info', duration = 5000): void => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { id, message, type, duration }
    const currentToasts = get().toasts
    set({ toasts: [...currentToasts, newToast] })

    // Auto-remove after duration
    setTimeout(() => {
      get().removeToast(id)
    }, duration)
  },

  removeToast: (id): void => {
    const currentToasts = get().toasts
    set({ toasts: currentToasts.filter((toast) => toast.id !== id) })
  },

  clearToasts: (): void => set({ toasts: [] }),
}))
