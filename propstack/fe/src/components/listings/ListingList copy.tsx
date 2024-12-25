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
  description?: string
}

export function ListingList() {
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

  return (
    <div className="space-y-4">
      {loading ? (
        <div>Loading...</div>
      ) : (
        listings.map(listing => (
          <div 
            key={listing.id}
            onClick={() => router.push(`/marketing/listings/${listing.id}`)}
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <h3 className="font-medium text-gray-900">{listing.address}</h3>
            <div className="text-sm text-gray-500">
              {listing.property_type} · {listing.listing_type}
            </div>
          </div>
        ))
      )}
    </div>
  )
} 