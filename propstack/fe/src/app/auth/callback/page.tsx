"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Get the stored path or default to home
        const returnPath = localStorage.getItem('authReturnPath') || '/'
        // Clear stored path
        localStorage.removeItem('authReturnPath')
        // Return to previous page
        router.push(returnPath)
      }
    })
  }, [router])

  return <div>Loading...</div>
} 