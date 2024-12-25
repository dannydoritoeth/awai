"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  MegaphoneIcon, 
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanknotesIcon,
  EnvelopeIcon,
  CalendarIcon,
  Cog8ToothIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface MenuItem {
  name: string
  href: string
  icon: typeof MegaphoneIcon
  items?: { name: string; href: string }[]
}

const menuItems: MenuItem[] = [
  {
    name: 'Listings',
    href: '/listings',
    icon: MegaphoneIcon,
    items: [
      { name: 'All Listings', href: '/listings' },
    ]
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: DocumentTextIcon,
    items: [
      { name: 'Agent Engagement', href: '/transactions/agent-engagement' },
      { name: 'Contracts', href: '/transactions/contracts' },
    ]
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: BanknotesIcon
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: EnvelopeIcon
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: CalendarIcon
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog8ToothIcon
  }
]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true)
  const pathname = usePathname()

  return (
    <div 
      className={clsx(
        "flex flex-col h-screen bg-indigo-900 text-white transition-all duration-300",
        isExpanded ? "w-64" : "w-16"
      )}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between p-4 border-b border-indigo-800">
        {isExpanded && <span className="text-xl font-semibold">PropStack</span>}
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
    </div>
  )
} 