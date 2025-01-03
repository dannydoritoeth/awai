"use client"

import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { UserCircleIcon, CreditCardIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { Menu } from '@headlessui/react'
import { ReactNode } from 'react'

interface HeaderProps {
  children?: ReactNode
}

export function Header({ children }: HeaderProps) {
  const { user, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      const checkAndInitCredits = async () => {
        try {
          const { data: existingCredits, error: selectError } = await supabase
            .from('credits')
            .select('balance')
            .eq('user_id', user.id)
            .single()

          if (selectError?.code === 'PGRST116') {
            const { data: newCredits, error: insertError } = await supabase
              .from('credits')
              .insert([
                { user_id: user.id, balance: 5 }
              ])
              .select()
              .single()

            if (newCredits) {
              setCredits(newCredits.balance)
            } else if (insertError) {
              console.error('Error creating credits:', insertError)
            }
          } else if (existingCredits) {
            setCredits(existingCredits.balance)
          }
        } catch (error) {
          console.error('Error in checkAndInitCredits:', error)
        }
      }

      checkAndInitCredits()
    }
  }, [user])

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {children ? (
          children
        ) : (
          <>
            {!user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                  <CreditCardIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">5 credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsJoining(false)
                      setShowAuthModal(true)
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => {
                      setIsJoining(true)
                      setShowAuthModal(true)
                    }}
                    className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showAuthModal && (
        <AuthModal 
          onClose={() => {
            setShowAuthModal(false)
            setIsJoining(false)
          }} 
          isJoining={isJoining}
        />
      )}
    </header>
  )
} 