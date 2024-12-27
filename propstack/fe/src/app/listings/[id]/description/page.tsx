"use client"

import { useEffect, useState, use } from 'react'
import { DescriptionGenerator } from '@/components/listings/description/DescriptionGenerator'
import { DescriptionViewer } from '@/components/listings/description/DescriptionViewer'
import { supabase } from '@/lib/supabase'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'

interface PageParams {
  params: Promise<{
    id: string
  }>
}

export default function DescriptionPage({ params }: PageParams) {
  const { id } = use(params)
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
          .eq('id', id)
          .single(),
        supabase
          .from('generated_descriptions')
          .select('*')
          .eq('listing_id', id)
          .order('created_at', { ascending: false })
      ])

      console.log('Descriptions loaded:', descriptionsRes.data) // Debug log
      
      if (listingRes.data) setListing(listingRes.data)
      if (descriptionsRes.data) {
        setDescriptions(descriptionsRes.data)
        setCurrentIndex(0)
      }
    }

    fetchData()
  }, [id])

  if (!listing) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => router.push(`/listings/${id}`)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Listing Description</h1>
          </div>
          <p className="text-gray-600 ml-11">{listing.address}</p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <DescriptionGenerator 
              listing={listing}
              onComplete={() => {
                // Refresh descriptions
                supabase
                  .from('generated_descriptions')
                  .select('*')
                  .eq('listing_id', id)
                  .order('created_at', { ascending: false })
                  .then(({ data }) => {
                    if (data) setDescriptions(data)
                  })
              }}
            />
          </div>
          
          <div>
            {descriptions.length > 0 ? (
              <DescriptionViewer
                listing={listing}
                descriptions={descriptions}
                currentIndex={currentIndex}
                onIndexChange={(index) => {
                  console.log('Changing index to:', index) // Debug log
                  setCurrentIndex(index)
                }}
                onComplete={() => {
                  // Refresh descriptions
                  supabase
                    .from('generated_descriptions')
                    .select('*')
                    .eq('listing_id', id)
                    .order('created_at', { ascending: false })
                    .then(({ data }) => {
                      if (data) setDescriptions(data)
                    })
                }}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-500">No descriptions generated yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 