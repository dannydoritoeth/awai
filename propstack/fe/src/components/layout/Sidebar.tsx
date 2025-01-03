"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  MegaphoneIcon, 
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanknotesIcon,
  EnvelopeIcon,
  CalendarIcon,
  Cog8ToothIcon,
  UserCircleIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { Menu } from '@headlessui/react'
import { AuthModal } from '@/components/auth/AuthModal'

interface MenuItem {
  name: string
  href: string
  icon: typeof MegaphoneIcon
  items?: { name: string; href: string }[]
}

const menuItems: MenuItem[] = [
  {
    name: 'Agent Engagements',
    href: '/transactions/agent-engagement',
    icon: DocumentTextIcon,
    items: [
      { name: 'All Engagements', href: '/transactions/agent-engagement' },
    ]
  },
  {
    name: 'Listings',
    href: '/listings',
    icon: MegaphoneIcon,
    items: [
      { name: 'All Listings', href: '/listings' },
    ]
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: EnvelopeIcon
  }
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const [isExpanded, setIsExpanded] = useState(true)
  const [credits, setCredits] = useState<number | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <>
      <div 
        className={clsx(
          "flex flex-col h-screen bg-indigo-900 text-white transition-all duration-300",
          isExpanded ? "w-64" : "w-16"
        )}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between p-4 border-b border-indigo-800">
          {isExpanded && (
            <Link href="/" className="text-xl font-semibold hover:text-indigo-200 transition-colors">
              PropStack
            </Link>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-indigo-800 rounded-md"
          >
            {isExpanded ? (
              <ChevronLeftIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="py-4">
            {menuItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center px-4 py-2 my-1 mx-2 rounded-md transition-colors",
                    pathname === item.href 
                      ? "bg-indigo-800 text-white" 
                      : "text-indigo-100 hover:bg-indigo-800"
                  )}
                >
                  <item.icon className="w-6 h-6 shrink-0" />
                  {isExpanded && (
                    <span className="ml-3">{item.name}</span>
                  )}
                </Link>
                {isExpanded && item.items && pathname.startsWith(item.href) && (
                  <ul className="ml-8 mt-1">
                    {item.items.map((subItem) => (
                      <li key={subItem.name}>
                        <Link
                          href={subItem.href}
                          className={clsx(
                            "block px-4 py-2 rounded-md text-sm transition-colors",
                            pathname === subItem.href 
                              ? "bg-indigo-800 text-white" 
                              : "text-indigo-100 hover:bg-indigo-800"
                          )}
                        >
                          {subItem.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile Area or Auth Buttons */}
        <div className="mt-auto border-t border-indigo-800 p-4">
          {user ? (
            <Menu as="div" className="relative">
              <Menu.Button className="w-full">
                <div className={clsx(
                  "flex items-center gap-3 p-2 rounded-md hover:bg-indigo-800 transition-colors",
                  isExpanded ? "justify-between" : "justify-center"
                )}>
                  {user.user_metadata?.avatar_url ? (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="w-8 h-8" />
                  )}
                  {isExpanded && (
                    <>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium truncate">{user.email}</div>
                        <div className={`flex items-center gap-1 text-xs ${
                          credits && credits <= 3 ? 'text-red-300' : 'text-indigo-300'
                        }`}>
                          <CreditCardIcon className="w-3 h-3" />
                          {credits} credits
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-indigo-300" />
                    </>
                  )}
                </div>
              </Menu.Button>

              <Menu.Items className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-md shadow-lg py-1 z-10">
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
            <div className={clsx(
              "flex gap-2",
              isExpanded ? "flex-col" : "flex-col items-center"
            )}>
              {isExpanded && (
                <div className="flex items-center gap-2 text-indigo-100 bg-indigo-800/50 px-3 py-1 rounded-full mb-2">
                  <CreditCardIcon className="w-4 h-4" />
                  <span className="text-sm">5 credits</span>
                </div>
              )}
              <button
                onClick={() => {
                  setIsJoining(false)
                  setShowAuthModal(true)
                }}
                className={clsx(
                  "text-indigo-100 hover:bg-indigo-800 rounded-md transition-colors",
                  isExpanded ? "w-full px-4 py-2" : "p-2"
                )}
              >
                <UserCircleIcon className={clsx(
                  "w-6 h-6",
                  !isExpanded && "mx-auto"
                )} />
                {isExpanded && <span>Sign in</span>}
              </button>
              {isExpanded && (
                <button
                  onClick={() => {
                    setIsJoining(true)
                    setShowAuthModal(true)
                  }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Join
                </button>
              )}
            </div>
          )}
        </div>
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
    </>
  )
} 