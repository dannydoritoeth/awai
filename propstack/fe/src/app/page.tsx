"use client"

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { MegaphoneIcon, DocumentTextIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) {
    return (
      <div className="h-full p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome to PropStack IO
        </h1>
      </div>
    )
  }

  const dashboardItems = [
    {
      name: 'Listings',
      description: 'Manage your property listings',
      href: '/listings',
      icon: MegaphoneIcon,
    },
    {
      name: 'Agent Engagements',
      description: 'Track and manage agent engagements',
      href: '/transactions/agent-engagement',
      icon: DocumentTextIcon,
    },
    {
      name: 'Messages',
      description: 'View and manage your messages',
      href: '/messages',
      icon: EnvelopeIcon,
    },
  ]

  return (
    <div className="h-full p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Dashboard
      </h1>
      <p className="text-gray-600 mb-8">Welcome to PropStack IO - your AI powered real estate assistant</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-lg">
                <item.icon className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
