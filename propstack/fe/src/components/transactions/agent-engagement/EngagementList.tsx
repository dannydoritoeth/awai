"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listEngagements, updateEngagementStatus } from '@/services/engagements'
import { Badge } from '@/components/ui/Badge'
import { PostgrestError } from '@supabase/supabase-js'
import { EllipsisHorizontalIcon, MagnifyingGlassIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Menu } from '@headlessui/react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface Engagement {
  id: string
  property_address: string
  seller_name: string
  created_at: string
  status: 'new' | 'title_search' | 'review' | 'agreement'
}

export function EngagementList() {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadEngagements()
  }, [])

  async function loadEngagements() {
    try {
      setError(null)
      const data = await listEngagements()
      setEngagements(data || [])
    } catch (err) {
      const error = err as Error | PostgrestError
      console.error('Error loading engagements:', error)
      setError(error.message || 'Failed to load engagements')
      setEngagements([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: Engagement['status']) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'title_search': return 'bg-yellow-100 text-yellow-800'
      case 'review': return 'bg-purple-100 text-purple-800'
      case 'agreement': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleStatusUpdate = async (id: string, status: 'title_search') => {
    try {
      await updateEngagementStatus(id, status)
      toast.success('Status updated successfully')
      // You might want to refresh the list here
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-white rounded-lg h-32"></div>
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-red-600 text-center">
          <p className="font-medium">Error loading engagements</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={() => loadEngagements()}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (engagements.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
        No engagements yet. Create your first engagement above.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/transactions"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="ml-1">Back to Transactions</span>
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            Agent Engagements
          </h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {engagements.map((engagement) => (
          <div
            key={engagement.id}
            onClick={() => router.push(`/transactions/agent-engagement/${engagement.id}`)}
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{engagement.property_address}</h3>
                <p className="text-sm text-gray-500">{engagement.seller_name}</p>
              </div>
              <Badge className={getStatusColor(engagement.status)}>
                {engagement.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            
            <Menu as="div" className="relative">
              <Menu.Button className="p-2 hover:bg-gray-50 rounded-full">
                <EllipsisHorizontalIcon className="w-5 h-5 text-gray-500" />
              </Menu.Button>
              
              <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => handleStatusUpdate(engagement.id, 'title_search')}
                        className={`${
                          active ? 'bg-gray-50' : ''
                        } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                      >
                        <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                        Start Title Search
                      </button>
                    )}
                  </Menu.Item>
                  {/* ... other menu items ... */}
                </div>
              </Menu.Items>
            </Menu>
          </div>
        ))}
      </div>
    </div>
  )
} 