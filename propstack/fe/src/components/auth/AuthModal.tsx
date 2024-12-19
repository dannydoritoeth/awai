"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { GoogleSignIn } from './GoogleSignIn'
import { EmailSignIn } from './EmailSignIn'
import { useState } from 'react'

interface AuthModalProps {
  onClose: () => void
  returnUrl?: string
}

export function AuthModal({ onClose, returnUrl = window.location.pathname }: AuthModalProps) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showEmailSignUp, setShowEmailSignUp] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const handleSignUpChange = (isSignUp: boolean) => {
    setShowEmailSignUp(isSignUp)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(() => {
          router.push(returnUrl)
          onClose()
        }, 100)
      }
    })

    return () => subscription.unsubscribe()
  }, [onClose, router, returnUrl])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium text-gray-900">
            {showEmailForm 
              ? (showEmailSignUp ? 'Sign Up with Email' : 'Sign In with Email')
              : 'Welcome to PropStack IO'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            ×
          </button>
        </div>

        {showEmailForm ? (
          <div>
            <button
              onClick={() => setShowEmailForm(false)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to options
            </button>
            <EmailSignIn onSignUpChange={handleSignUpChange} />
          </div>
        ) : (
          <div className="space-y-4">
            <GoogleSignIn returnUrl={returnUrl} />
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Continue with Email
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 