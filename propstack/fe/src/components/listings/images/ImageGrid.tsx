import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import debounce from 'lodash/debounce'

interface ImageGridProps {
  images: Array<{
    id: string
    url: string
    order_index: number
    caption?: string
  }>
  onDelete: (imageId: string) => void
  onCaptionUpdate?: (imageId: string, caption: string) => Promise<void>
  onOpenAIEdit?: (imageId: string) => void
}

interface ImageWithSignedUrl {
  id: string
  signedUrl?: string
  isLoading: boolean
  caption?: string
}

export function ImageGrid({ 
  images, 
  onDelete,
  onCaptionUpdate,
  onOpenAIEdit
}: ImageGridProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, ImageWithSignedUrl>>({})
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [editingCaptions, setEditingCaptions] = useState<Record<string, string>>({})
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({})

  // Initialize or update signed URLs for new images only
  useEffect(() => {
    images.forEach(image => {
      if (!signedUrls[image.id]) {
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

  // Create a debounced save function for each image
  const debouncedSave = useRef(
    debounce(async (imageId: string, caption: string) => {
      if (!onCaptionUpdate) return
      
      setSavingStates(prev => ({ ...prev, [imageId]: true }))
      try {
        await onCaptionUpdate(imageId, caption)
      } finally {
        setSavingStates(prev => ({ ...prev, [imageId]: false }))
      }
    }, 1000)
  ).current

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {images.map((image) => {
        const signedUrlData = signedUrls[image.id]
        const isSaving = savingStates[image.id]
        
        if (!signedUrlData || signedUrlData.isLoading) {
          return (
            <div key={image.id} className="space-y-4">
              <div className="relative aspect-[4/3] bg-gray-100 animate-pulse rounded-lg" />
              <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
            </div>
          )
        }

        if (!signedUrlData.signedUrl) return null

        return (
          <div key={image.id} className="space-y-4">
            {/* Image Container */}
            <div className="relative aspect-[4/3] group">
              <img
                src={signedUrlData.signedUrl}
                alt=""
                className="w-full h-full object-cover rounded-lg"
                onClick={() => signedUrlData.signedUrl && setLightboxImage(signedUrlData.signedUrl)}
              />
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all">
                <div className="absolute top-2 right-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onOpenAIEdit?.(image.id)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                    title="Edit with AI"
                  >
                    <SparklesIcon className="w-5 h-5 text-blue-500" />
                  </button>
                  <button
                    onClick={() => onDelete(image.id)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                  >
                    <XMarkIcon className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Caption Area */}
            <div className="relative">
              <textarea
                value={editingCaptions[image.id] ?? image.caption ?? ''}
                onChange={(e) => {
                  const newCaption = e.target.value
                  setEditingCaptions(prev => ({ ...prev, [image.id]: newCaption }))
                  debouncedSave(image.id, newCaption)
                }}
                className="w-full min-h-[6rem] p-3 text-gray-700 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Add a caption..."
              />
              {isSaving && (
                <div className="absolute right-2 top-2 text-sm text-gray-500">
                  Saving...
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
} 