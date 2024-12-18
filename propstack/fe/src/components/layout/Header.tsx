"use client"

import { useAuth } from '@/contexts/AuthContext'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import Link from 'next/link'

export function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link 
          href="/" 
          className="text-xl font-medium text-gray-900 hover:text-gray-700 transition-colors"
        >
          PropStack IO
        </Link>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-gray-600">{user.email}</div>
              <button
                onClick={signOut}
                className="text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <GoogleSignIn />
          )}
        </div>
      </div>
    </header>
  )
} 