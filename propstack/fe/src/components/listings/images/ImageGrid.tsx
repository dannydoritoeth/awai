import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { XMarkIcon, EllipsisHorizontalIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

interface ImageGridProps {
  images: Array<{
    id: string
    url: string
    order_index: number
    caption?: string
  }>
  onDelete: (imageId: string) => void
  onTransform?: (imageId: string, type: 'enhance' | 'relight' | 'upscale') => Promise<void>
}

interface ImageWithSignedUrl {
  id: string
  signedUrl?: string
  isLoading: boolean
  caption?: string
}

export function ImageGrid({ images, onDelete, onTransform }: ImageGridProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, ImageWithSignedUrl>>({})
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [transforming, setTransforming] = useState<string | null>(null)

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
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image) => {
          const signedUrlData = signedUrls[image.id]
          
          if (!signedUrlData || signedUrlData.isLoading) {
            return (
              <div key={image.id} className="relative group aspect-square bg-gray-100 animate-pulse rounded-lg" />
            )
          }

          if (!signedUrlData.signedUrl) return null

          const isTransforming = transforming === image.id

          return (
            <div key={image.id} className="relative group">
              <div className="aspect-square">
                <div 
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setLightboxImage(signedUrlData.signedUrl || null)}
                >
                  <img
                    src={signedUrlData.signedUrl}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover rounded-lg ${isTransforming ? 'opacity-50' : ''}`}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      console.error('Image failed to load:', signedUrlData.signedUrl)
                    }}
                  />
                  
                  {isTransforming && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption */}
              {image.caption && (
                <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                  {image.caption}
                </div>
              )}
              
              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onTransform && (
                  <Menu as="div" className="relative">
                    <Menu.Button
                      className="p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                      disabled={isTransforming}
                    >
                      <EllipsisHorizontalIcon className="w-5 h-5" />
                    </Menu.Button>
                    
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`${
                                  active ? 'bg-gray-100' : ''
                                } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                onClick={async () => {
                                  setTransforming(image.id)
                                  try {
                                    await onTransform(image.id, 'enhance')
                                  } finally {
                                    setTransforming(null)
                                  }
                                }}
                              >
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                Enhance Image
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`${
                                  active ? 'bg-gray-100' : ''
                                } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                onClick={async () => {
                                  setTransforming(image.id)
                                  try {
                                    await onTransform(image.id, 'relight')
                                  } finally {
                                    setTransforming(null)
                                  }
                                }}
                              >
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                Relight
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`${
                                  active ? 'bg-gray-100' : ''
                                } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                onClick={async () => {
                                  setTransforming(image.id)
                                  try {
                                    await onTransform(image.id, 'upscale')
                                  } finally {
                                    setTransforming(null)
                                  }
                                }}
                              >
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                Upscale
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(image.id)
                  }}
                  className="p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
    </>
  )
} 