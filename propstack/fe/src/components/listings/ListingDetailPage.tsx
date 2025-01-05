"use client"

import { useEffect, useState } from 'react'
import { PageHeading } from '@/components/layout/PageHeading'
import { ReviewForm } from '@/components/listings/steps/ReviewForm'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { ListingActions } from '@/components/listings/ListingActions'
import Link from 'next/link'

interface ListingDetailPageProps {
  id: string
}

export function ListingDetailPage({ id }: ListingDetailPageProps) {
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchListing = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          agent_engagements (
            id,
            property_address,
            seller_name
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching listing:', error)
        return
      }

      setListing(data)
      setLoading(false)
    }

    fetchListing()
  }, [id])

  if (loading) {
    return (
      <div className="h-full p-8">
        <div className="flex justify-center">
          <Spinner />
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="h-full p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Listing not found</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Listing Details"
        description="Review and manage your listing"
        backHref="/listings"
        showBackButton
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Review Form */}
        <div className="lg:col-span-2">
          <ReviewForm 
            data={listing}
            readOnly
            onBack={() => router.push('/listings')}
            onSubmit={() => {}}
            loading={false}
          />
        </div>

        {/* Right column - Actions */}
        <div className="space-y-6">
          <ListingActions 
            listingId={id}
            statuses={{
              description: listing.description_status,
              titleCheck: listing.title_check_status,
              socialMedia: listing.social_media_status,
              images: listing.images_status
            }}
          />

          {/* Agent Engagement Link */}
          {listing.agent_engagements && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Agent Engagement</h3>
              <Link
                href={`/transactions/agent-engagement/${listing.agent_engagements.id}`}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View Agent Engagement
              </Link>
              <div className="mt-2 text-sm text-gray-600">
                <div>Property: {listing.agent_engagements.property_address}</div>
                <div>Seller: {listing.agent_engagements.seller_name}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 