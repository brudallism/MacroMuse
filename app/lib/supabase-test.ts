// Test file to verify Supabase connection works
import { supabase, getCurrentUser, isAuthenticated } from './supabase'

export const testSupabaseConnection = async (): Promise<boolean> => {
  // console.log('🧪 Testing Supabase connection...')

  try {
    // Test 1: Basic connection
    const { data, error } = await supabase
      .from('migration_history')
      .select('migration_name')
      .limit(1)

    if (error) {
      // console.error('❌ Connection failed:', error.message)
      return false
    }

    // console.log('✅ Supabase connection successful!')
    // console.log(`📋 Found ${data?.length || 0} migration records`)

    // Test 2: Auth status
    const authStatus = await isAuthenticated()
    // console.log(`🔐 Authentication status: ${authStatus ? 'Signed in' : 'Not signed in'}`)

    // Test 3: Try to access a protected table (should fail without auth)
    const { error: profileError } = await supabase.from('profile').select('id').limit(1)

    if (profileError) {
      // console.log('🛡️ RLS working - profile access requires authentication')
    } else {
      // console.log(`👤 Profile access: ${profileData?.length || 0} records visible`)
    }

    // console.log('✅ Supabase setup is working correctly!')
    return true
  } catch (err) {
    // console.error('❌ Supabase test failed:', err)
    return false
  }
}

// Test function for authenticated operations (call after sign-in)
export const testAuthenticatedOperations = async (): Promise<boolean> => {
  // console.log('🧪 Testing authenticated operations...')

  try {
    const user = await getCurrentUser()
    // console.log(`👤 Current user: ${user?.email || 'Not signed in'}`)

    if (!user) {
      // console.log('⚠️ User not authenticated - sign in first')
      return false
    }

    // Test creating a profile
    const { error: profileError } = await supabase
      .from('profile')
      .upsert({
        user_id: user.id,
        email: user.email ?? 'test@example.com',
        name: 'Test User',
        units: 'metric',
      } as any)
      .select()

    if (profileError) {
      // console.error('❌ Profile creation failed:', profileError.message)
      return false
    }

    // console.log('✅ Profile created/updated successfully!')

    // Test creating a goal
    const { error: goalError } = await supabase
      .from('goal_base')
      .insert({
        user_id: user.id,
        goal_type: 'maintain',
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 67,
      } as any)
      .select()

    if (goalError) {
      // console.error('❌ Goal creation failed:', goalError.message)
      return false
    }

    // console.log('✅ Goal created successfully!')
    // console.log('🎉 All authenticated operations working!')

    return true
  } catch (err) {
    // console.error('❌ Authenticated test failed:', err)
    return false
  }
}
