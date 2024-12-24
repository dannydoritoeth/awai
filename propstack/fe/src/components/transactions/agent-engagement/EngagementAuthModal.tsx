"use client"

import { useRef, useEffect } from 'react'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { EmailSignIn } from '@/components/auth/EmailSignIn'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

interface EngagementAuthModalProps {
  onClose: () => void
}

export function EngagementAuthModal({ onClose }: EngagementAuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Handle clicks outside modal
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    // Store current path for after auth
    localStorage.setItem('authReturnPath', pathname)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onClose()
      }
    })

    return () => subscription.unsubscribe()
  }, [onClose, pathname])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Sign in to Save Engagement
        </h2>
        <p className="text-gray-600 mb-6">
          Your engagement details have been saved. Sign in to complete the process.
        </p>
        <div className="space-y-4">
          <GoogleSignIn />
          <EmailSignIn onSignUpChange={() => {}} />
        </div>
      </div>
    </div>
  )
} 