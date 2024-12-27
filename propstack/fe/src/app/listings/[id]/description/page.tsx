"use client"

import { useEffect, useState } from 'react'
import { DescriptionGenerator } from '@/components/listings/description/DescriptionGenerator'
import { DescriptionViewer } from '@/components/listings/description/DescriptionViewer'
import { supabase } from '@/lib/supabase'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

export default function DescriptionPage({ params }: { params: { id: string } }) {
  const [listing, setListing] = useState<any>(null)
  const [descriptions, setDescriptions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, descriptionsRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .eq('id', params.id)
          .single(),
        supabase
          .from('generated_descriptions')
          .select('*')
          .eq('listing_id', params.id)
          .order('created_at', { ascending: false })
      ])

      if (listingRes.data) setListing(listingRes.data)
      if (descriptionsRes.data) setDescriptions(descriptionsRes.data)
    }

    fetchData()
  }, [params.id])

  if (!listing) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => router.push(`/listings/${params.id}`)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Listing Description</h1>
        </div>
        <p className="text-gray-600 ml-11">{listing.address}</p>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <DescriptionGenerator 
            listing={listing}
            onComplete={() => {
              // Refresh descriptions
              supabase
                .from('generated_descriptions')
                .select('*')
                .eq('listing_id', params.id)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                  if (data) setDescriptions(data)
                })
            }}
          />
        </div>
        
        <div>
          {descriptions.length > 0 && (
            <DescriptionViewer
              listing={listing}
              descriptions={descriptions}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
            />
          )}
        </div>
      </div>
    </div>
  )
} 