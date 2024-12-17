"use client"

import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { AuthModal } from '../auth/AuthModal'

export function Header() {
  const { user, isAnonymous, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">PropStack IO</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <BellIcon className="w-6 h-6 text-gray-600" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </div>
          <div className="flex items-center gap-2">
            <UserCircleIcon className="w-6 h-6 text-gray-600" />
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  {isAnonymous ? 'Anonymous User' : user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </header>
  )
} 