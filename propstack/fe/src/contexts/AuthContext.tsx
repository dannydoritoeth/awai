"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  isAnonymous: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  continueAnonymously: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsAnonymous(session?.user?.aud === 'anonymous')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAnonymous(session?.user?.aud === 'anonymous')
    })

    return () => subscription.unsubscribe()
  }, [])

  const continueAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('Anonymous login error:', error)
      throw error
    }
    return data
  }

  const value = {
    user,
    isAnonymous,
    signUp: async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    },
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signInWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://iamsccvlyhmdnkawuich.supabase.co/auth/v1/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })
      if (error) throw error
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    continueAnonymously: continueAnonymously
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 