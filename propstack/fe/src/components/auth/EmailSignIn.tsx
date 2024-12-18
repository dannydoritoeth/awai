"use client"

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function EmailSignIn({ onSignUpChange }: { onSignUpChange: (isSignUp: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signInWithEmail, signUpWithEmail } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
        alert('Check your email to confirm your account')
      } else {
        await signInWithEmail(email, password)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleSignUpToggle = () => {
    const newValue = !isSignUp
    setIsSignUp(newValue)
    onSignUpChange(newValue)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
      >
        {isSignUp ? 'Sign Up with Email' : 'Sign In with Email'}
      </button>

      <button
        type="button"
        onClick={handleSignUpToggle}
        className="w-full text-sm text-gray-600 hover:text-gray-900"
      >
        {isSignUp 
          ? 'Already have an account? Sign in' 
          : 'Need an account? Sign up'}
      </button>
    </form>
  )
} 