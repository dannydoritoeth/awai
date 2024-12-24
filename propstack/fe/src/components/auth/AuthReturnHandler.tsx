"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function AuthReturnHandler() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      const returnPath = localStorage.getItem('authReturnPath')
      if (returnPath) {
        localStorage.removeItem('authReturnPath')
        router.push(returnPath)
      }
    }
  }, [user, router])

  return null
} 