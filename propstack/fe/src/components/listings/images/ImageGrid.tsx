import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ImageGridProps {
  images: Array<{
    id: string
    url: string  // This is now just the file path
    order_index: number
  }>
  onDelete: (imageId: string) => void
}

interface ImageWithSignedUrl {
  id: string
  signedUrl?: string
  isLoading: boolean
}

export function ImageGrid({ images, onDelete }: ImageGridProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, ImageWithSignedUrl>>({})

  // Initialize or update signed URLs for new images only
  useEffect(() => {
    images.forEach(image => {
      if (!signedUrls[image.id]) {
        // Only fetch signed URL if we don't already have it
        setSignedUrls(prev => ({
          ...prev,
          [image.id]: { id: image.id, isLoading: true }
        }))

        supabase.storage
          .from('listing-images')
          .createSignedUrl(image.url, 3600)
          .then(({ data, error }) => {
            if (error) {
              console.error('Error creating signed URL:', error)
              return
            }
            if (data?.signedUrl) {
              setSignedUrls(prev => ({
                ...prev,
                [image.id]: {
                  id: image.id,
                  signedUrl: data.signedUrl,
                  isLoading: false
                }
              }))
            }
          })
          .catch(error => {
            console.error('Error getting signed URL:', error)
          })
      }
    })

    // Clean up any signed URLs for images that no longer exist
    setSignedUrls(prev => {
      const currentImageIds = new Set(images.map(img => img.id))
      const updated = { ...prev }
      Object.keys(updated).forEach(id => {
        if (!currentImageIds.has(id)) {
          delete updated[id]
        }
      })
      return updated
    })
  }, [images])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {images.map((image) => {
        const signedUrlData = signedUrls[image.id]
        
        // Show nothing while loading the first time
        if (!signedUrlData || signedUrlData.isLoading) {
          return (
            <div key={image.id} className="relative group aspect-square bg-gray-100 animate-pulse rounded-lg" />
          )
        }

        return (
          <div key={image.id} className="relative group aspect-square">
            <div className="relative w-full h-full">
              <img
                src={signedUrlData.signedUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  console.error('Image failed to load:', signedUrlData.signedUrl)
                }}
              />
            </div>
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => onDelete(image.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 