"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Function to force logout and redirect
  const forceLogout = async () => {
    const currentPath = window.location.pathname
    localStorage.setItem('authReturnPath', currentPath)
    await supabase.auth.signOut()
    setUser(null)
    router.push('/auth/login')
  }

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!session) {
          await forceLogout()
          return
        }

        // Check if token is expired
        if (session.expires_at && session.expires_at * 1000 < Date.now()) {
          await forceLogout()
          return
        }

        setUser(session.user)
      } catch (error) {
        console.error('Session check error:', error)
        await forceLogout()
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/auth/login')
      } else if (session?.user) {
        // Check if token is expired
        if (session.expires_at && session.expires_at * 1000 < Date.now()) {
          await forceLogout()
          return
        }
        setUser(session.user)
      }
      setLoading(false)
    })

    // Check session periodically
    const intervalId = setInterval(checkSession, 60000) // Check every minute

    return () => {
      subscription.unsubscribe()
      clearInterval(intervalId)
    }
  }, [router])

  const signInWithGoogle = async (redirectTo?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnUrl=${redirectTo || '/'}`
      }
    })
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Error signing in:', error)
      throw error
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      console.error('Error signing up:', error)
      throw error
    }
  }

  const signOut = async () => {
    await forceLogout()
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        signInWithGoogle, 
        signInWithEmail,
        signUpWithEmail,
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 