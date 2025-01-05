import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a custom fetch function that handles auth errors
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const response = await fetch(input, init)
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      const clonedResponse = response.clone()
      const data = await clonedResponse.json()
      
      if (
        data?.error?.message?.includes('JWT expired') ||
        data?.error?.message?.includes('Invalid JWT') ||
        data?.error?.message?.includes('JWT must be provided') ||
        data?.statusCode === '400'
      ) {
        // Clear all auth data
        localStorage.clear()
        // Force reload to login page
        window.location.href = '/auth/login'
        throw new Error('Session expired')
      }
    }
    
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'Session expired') {
      throw error
    }
    return fetch(input, init)
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: customFetch
  }
}) 