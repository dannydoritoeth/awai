"use client"

import { useState } from 'react'
import { GoogleSignIn } from './GoogleSignIn'
import { EmailSignIn } from './EmailSignIn'

export function SignInMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showEmailSignUp, setShowEmailSignUp] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        Sign In
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          {showEmailForm ? (
            <div>
              <button
                onClick={() => setShowEmailForm(false)}
                className="text-sm text-gray-600 hover:text-gray-900 mb-4"
              >
                ← Back to options
              </button>
              <EmailSignIn onSignUpChange={(isSignUp) => setShowEmailSignUp(isSignUp)} />
            </div>
          ) : (
            <div className="space-y-4">
              <GoogleSignIn />
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Sign in with Email
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 