"use client"

import { AuthModal } from '@/components/auth/AuthModal'
import { useRef, useEffect } from 'react'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { EmailSignIn } from '@/components/auth/EmailSignIn'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

interface EngagementAuthModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export function EngagementAuthModal({ onClose, onSuccess }: EngagementAuthModalProps) {
  const pathname = usePathname()

  useEffect(() => {
    // Store current path for after auth
    localStorage.setItem('authReturnPath', pathname)
  }, [pathname])

  const handleSuccess = () => {
    onSuccess?.()
    onClose()
  }

  return (
    <AuthModal 
      onClose={onClose}
      onSuccess={handleSuccess}
      message="Please log in or sign up to save your engagement"
    />
  )
} 