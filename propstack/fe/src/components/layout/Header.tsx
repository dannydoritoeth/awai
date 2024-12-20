"use client"

import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

export function Header() {
  const { user, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showFreeContent, setShowFreeContent] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link 
            href="/" 
            className="text-xl font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            PropStack IO
          </Link>

          <nav className="flex items-center gap-6">
            <Link 
              href="/plans" 
              className="text-gray-600 hover:text-gray-900"
            >
              Plans
            </Link>

            <div className="relative">
              <button
                onClick={() => setShowFreeContent(!showFreeContent)}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
              >
                Free Content
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showFreeContent && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg py-1">
                  <a
                    href="https://www.youtube.com/@scott.bradley.16940"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    YouTube
                  </a>
                </div>
              )}
            </div>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-gray-600">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </header>
  )
} 