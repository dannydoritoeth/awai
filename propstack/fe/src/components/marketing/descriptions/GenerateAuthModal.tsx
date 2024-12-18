"use client"

import { useRef, useEffect } from 'react'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { EmailSignIn } from '@/components/auth/EmailSignIn'
import { supabase } from '@/lib/supabase'

interface GenerateAuthModalProps {
  onClose: () => void
  onAuth: () => void
}

export function GenerateAuthModal({ onClose, onAuth }: GenerateAuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

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
    const handleAuth = () => {
      onAuth()
      onClose()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        handleAuth()
      }
    })

    return () => subscription.unsubscribe()
  }, [onAuth, onClose])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Sign in to Generate Description
        </h2>
        <p className="text-gray-600 mb-6">
          Your listing details have been saved. Sign in to generate the description.
        </p>
        <div className="space-y-4">
          <GoogleSignIn />
          <EmailSignIn onSignUpChange={() => {}} />
        </div>
      </div>
    </div>
  )
} 