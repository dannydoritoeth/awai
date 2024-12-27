import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ImageGridProps {
  images: Array<{
    id: string
    url: string
    order_index: number
  }>
  onDelete: (imageId: string) => void
}

export function ImageGrid({ images, onDelete }: ImageGridProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    console.log('Images received:', images)
    
    const loadSignedUrls = async () => {
      const urls: Record<string, string> = {}
      
      for (const image of images) {
        try {
          // Extract just the file path from the full URL
          const filePath = image.url.includes('listing-images/') 
            ? image.url.split('listing-images/')[1] 
            : image.url

          console.log('Trying to get signed URL for path:', filePath)
          const { data, error } = await supabase.storage
            .from('listing-images')
            .createSignedUrl(filePath, 24 * 60 * 60)
          
          if (error) {
            console.error('Error creating signed URL:', error)
            continue
          }
          
          if (data?.signedUrl) {
            console.log('Got signed URL for', image.id, ':', data.signedUrl)
            urls[image.id] = data.signedUrl
          }
        } catch (e) {
          console.error('Error getting signed URL for', image.url, ':', e)
        }
      }

      console.log('Final signed URLs:', urls)
      setSignedUrls(urls)
    }

    loadSignedUrls()
  }, [images])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {images.map((image) => {
        const imageUrl = signedUrls[image.id]
        
        if (!imageUrl) {
          return null // Skip if we don't have a signed URL yet
        }
        
        return (
          <div key={image.id} className="relative group aspect-square">
            <div className="relative w-full h-full">
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  console.error('Image failed to load:', imageUrl)
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