"use client"

import { useEffect, useState, use } from 'react'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingWizard } from '@/components/listings/ListingWizard'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'

interface EditListingPageProps {
  params: Promise<{
    id: string
  }>
}

export default function EditListingPage({ params }: EditListingPageProps) {
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
        router.push('/listings')
        return
      }

      // Transform database fields to match form field names
      const transformedData = {
        ...data,
        propertyType: data.property_type,
        listingType: data.listing_type,
        lotSize: data.lot_size,
        lotSizeUnit: data.lot_size_unit,
        interiorSize: data.interior_size,
        interiorSizeUnit: data.interior_size_unit,
        propertyHighlights: data.property_highlights || [],
        locationHighlights: data.location_highlights || [],
        locationNotes: data.location_notes,
        otherDetails: data.other_details,
      }

      setListing(transformedData)
      setLoading(false)
    }

    fetchListing()
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
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
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Edit Listing"
          description="Update your listing details"
          backHref={`/listings/${id}`}
          showBackButton
        />
        
        <div className="mt-8">
          <ListingWizard 
            initialData={listing}
            mode="edit"
            listingId={id}
          />
        </div>
      </main>
    </div>
  )
} 