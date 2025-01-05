"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon 
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'

interface Listing {
  id: string
  address: string
  property_type: string
  listing_type: string
  created_at: string
  status: string
}

export function ListingsTable() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadListings()
  }, [])

  async function loadListings() {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setListings(data || [])
    } catch (err) {
      console.error('Error loading listings:', err)
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  if (error) {
    return <div className="text-red-600 py-4">{error}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Address
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {!listings.length ? (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-center whitespace-nowrap">
                <div className="text-sm text-gray-500">No listings found</div>
              </td>
            </tr>
          ) : (
            listings.map(listing => (
              <tr 
                key={listing.id}
                onClick={() => router.push(`/listings/${listing.id}`)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {listing.address}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {listing.property_type} · {listing.listing_type}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(listing.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                    ${listing.status === 'published' ? 'bg-green-100 text-green-800' : 
                      listing.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'}`}
                  >
                    {listing.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
} 