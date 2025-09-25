import { createClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable for React Native
  },
})

// Helper to get current user
export const getCurrentUser = async (): Promise<any> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Helper to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user
}

// Helper for safe database queries with better error handling
export const safeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>
): Promise<T | null> => {
  try {
    const { data, error } = await queryFn()
    if (error) {
      // console.error('Database query error:', error)
      throw error
    }
    return data
  } catch (err) {
    // console.error('Supabase query failed:', err)
    throw err
  }
}
