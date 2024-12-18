"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Listing {
  id: string
  address: string
  property_type: string
  listing_type: string
  created_at: string
}

export function SavedListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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
    } catch (error) {
      console.error('Error loading listings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-white rounded-lg h-32"></div>
  }

  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-gray-500 text-center">
        No listings yet. Create your first listing above.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map(listing => (
        <div
          key={listing.id}
          onClick={() => router.push(`/marketing/listings/${listing.id}`)}
          className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-medium text-gray-900">{listing.address}</h3>
          <div className="text-sm text-gray-500 mt-1">
            {listing.property_type} · {listing.listing_type}
          </div>
        </div>
      ))}
    </div>
  )
} 