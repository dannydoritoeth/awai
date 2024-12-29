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
  const [showFreeContent, setShowFreeContent] = useState(false)
  const router = useRouter()
  const [credits, setCredits] = useState<number | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const freeContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      const checkAndInitCredits = async () => {
        try {
          console.log('Checking credits for user:', user.id);
          
          const { data: existingCredits, error: selectError } = await supabase
            .from('credits')
            .select('balance')
            .eq('user_id', user.id)
            .single()

          console.log('Existing credits:', existingCredits, 'Error:', selectError);

          if (selectError?.code === 'PGRST116') {
            console.log('No credits found, creating initial credits');
            
            const { data: newCredits, error: insertError } = await supabase
              .from('credits')
              .insert([
                { user_id: user.id, balance: 5 }
              ])
              .select()
              .single()

            console.log('New credits created:', newCredits, 'Error:', insertError);

            if (newCredits) {
              setCredits(newCredits.balance)
            } else if (insertError) {
              console.error('Error creating credits:', insertError)
            }
          } else if (existingCredits) {
            console.log('Setting existing credits:', existingCredits.balance);
            setCredits(existingCredits.balance)
          }
        } catch (error) {
          console.error('Error in checkAndInitCredits:', error)
        }
      }

      checkAndInitCredits()
    } else {
      console.log('No user found')
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (freeContentRef.current && !freeContentRef.current.contains(event.target as Node)) {
        setShowFreeContent(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function getUserEmail() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    }
    getUserEmail()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {children ? (
          children
        ) : (
          <>
            <div className="flex items-center gap-8">
              <Link 
                href="/" 
                className="text-xl font-medium text-gray-900 hover:text-gray-700 transition-colors"
              >
                PropStack IO
              </Link>

              <nav className="flex items-center gap-6">
                {/* <Link 
                  href="/pricing" 
                  className="text-gray-600 hover:text-gray-900"
                >
                  Pricing
                </Link> */}

                <div className="relative" ref={freeContentRef}>
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
                <Menu as="div" className="relative">
                  <Menu.Button className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${
                      credits && credits <= 3 
                        ? 'text-red-600 bg-red-50' 
                        : 'text-gray-600 bg-gray-50'
                      } px-3 py-1 rounded-full`}
                    >
                      <CreditCardIcon className={`w-4 h-4 ${
                        credits && credits <= 3 ? 'text-red-600' : 'text-gray-600'
                      }`} />
                      <span className="text-sm font-medium">
                        {credits} credits
                      </span>
                    </div>
                    {user.user_metadata?.avatar_url ? (
                      <Image
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="w-8 h-8 text-gray-600" />
                    )}
                  </Menu.Button>

                  <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      {user.email}
                    </div>
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="mailto:scott@acceleratewith.ai?subject=PropStack%20Credits%20Request"
                          className={`block px-4 py-2 text-sm text-gray-700 ${
                            active ? 'bg-gray-100' : ''
                          }`}
                        >
                          Request more credits
                        </a>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleSignOut}
                          className={`w-full text-left px-4 py-2 text-sm text-red-600 ${
                            active ? 'bg-gray-50' : ''
                          }`}
                        >
                          Sign Out
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              ) : (
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
            </div>
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