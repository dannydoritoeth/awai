"use client"

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/listings')
    }
  }, [user, router])

  return (
    <div className="h-full p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Welcome to PropStack IO
      </h1>
    </div>
  )
}
