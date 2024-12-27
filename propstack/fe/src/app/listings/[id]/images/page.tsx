"use client"

import { useEffect, useState, use } from 'react'
import { ImageManager } from '@/components/listings/images/ImageManager'
import { supabase } from '@/lib/supabase'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'

interface ImagesPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ImagesPage({ params }: ImagesPageProps) {
  const { id } = use(params)
  const [listing, setListing] = useState<any>(null)
  const [images, setImages] = useState([])
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, imagesRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('listing_images')
          .select('*')
          .eq('listing_id', id)
          .order('order')
      ])
      
      if (listingRes.data) setListing(listingRes.data)
      if (imagesRes.data) setImages(imagesRes.data)
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
            <h1 className="text-2xl font-semibold text-gray-900">Listing Images</h1>
          </div>
          <p className="text-gray-600 ml-11">{listing.address}</p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <ImageManager 
              listingId={id}
              images={images}
            />
          </div>
          
          <div>
            {/* Right column can be used for preview or additional information */}
          </div>
        </div>
      </div>
    </div>
  )
} 