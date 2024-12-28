'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'

interface AIImageEditorPageProps {
  params: {
    id: string
  }
}

export default function AIImageEditorPage({ params }: AIImageEditorPageProps) {
  const { id: listingId } = params
  const searchParams = useSearchParams()
  const imageId = searchParams.get('imageId')
  const [image, setImage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!imageId) {
      router.push(`/listings/${listingId}/images`)
      return
    }

    const fetchImage = async () => {
      const { data, error } = await supabase
        .from('listing_images')
        .select('*')
        .eq('id', imageId)
        .single()

      if (error) {
        console.error('Error fetching image:', error)
        router.push(`/listings/${listingId}/images`)
        return
      }

      setImage(data)
      setLoading(false)
    }

    fetchImage()
  }, [imageId, listingId, router])

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

  if (!image) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Image not found</h2>
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
          title="AI Image Editor"
          description="Edit your image using AI"
          backHref={`/listings/${listingId}/images`}
          showBackButton
        />
        
        <div className="mt-8">
          {/* AI Image Editor UI will go here */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Coming Soon</h2>
            <p className="text-gray-600">
              The AI Image Editor is currently under development. Check back soon for updates!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
} 