"use client"

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      const returnUrl = searchParams.get('returnUrl') || '/'
      router.push(returnUrl)
    }
  }, [user, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-600">
        Completing sign in...
      </div>
    </div>
  )
} 