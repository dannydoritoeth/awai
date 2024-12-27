"use client"

import { useEffect, useState, use } from 'react'
import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { ReviewForm } from '@/components/listings/steps/ReviewForm'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { ListingActions } from '@/components/listings/ListingActions'

interface ListingDetailProps {
  params: Promise<{
    id: string
  }>
}

export default function ListingDetailPage({ params }: ListingDetailProps) {
  const { id } = use(params)
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchListing = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <Spinner />
          </div>
        </main>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Listing not found</h2>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
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
          </div>
        </div>
      </main>
    </div>
  )
} 