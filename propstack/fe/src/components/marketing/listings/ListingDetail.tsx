"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ListingDetailProps {
  listingId: string
}

export function ListingDetail({ listingId }: ListingDetailProps) {
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadListing() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/signin') // or wherever you want to redirect
          return
        }

        const { data, error } = await supabase
          .from('listings')
          .select(`
            *,
            generated_descriptions (
              content,
              language,
              version,
              created_at
            )
          `)
          .eq('id', listingId)
          .eq('user_id', user.id)
          .single()

        if (error) throw error
        if (!data) throw new Error('Listing not found')

        setListing(data)
      } catch (err) {
        console.error('Error loading listing:', err)
        setError(err instanceof Error ? err.message : 'Failed to load listing')
      } finally {
        setLoading(false)
      }
    }

    loadListing()
  }, [listingId, router])

  if (loading) {
    return <div className="animate-pulse bg-white rounded-lg h-32"></div>
  }

  if (error || !listing) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Unable to load listing
        </h2>
        <p className="text-gray-600">
          {error || 'The listing could not be found'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-medium text-gray-900">{listing.address}</h2>
        <div className="mt-2 text-gray-500">
          {listing.property_type} · {listing.listing_type}
        </div>
      </div>

      {/* Rest of your listing detail UI */}
    </div>
  )
} 