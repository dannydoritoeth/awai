'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from './ImageUploader'
import { ImageGrid } from './ImageGrid'
import { supabase } from '@/lib/supabase'

interface ImageManagerProps {
  listingId: string
  images: Array<{
    id: string
    url: string
    order_index: number
  }>
}

export function ImageManager({ listingId, images }: ImageManagerProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpload = async (files: FileList) => {
    setLoading(true)
    try {
      const uploads = Array.from(files).map(async (file) => {
        // Create a unique file path
        const fileName = `${listingId}/${Date.now()}-${file.name}`
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file)

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          throw uploadError
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName)

        // Create database record
        const { error: dbError } = await supabase
          .from('listing_images')
          .insert({
            listing_id: listingId,
            url: publicUrl,
            order_index: images.length + 1
          })

        if (dbError) {
          console.error('Database insert error:', dbError)
          throw dbError
        }
      })

      await Promise.all(uploads)
      router.refresh()
    } catch (err) {
      console.error('Error uploading images:', err)
      // You might want to show a toast or error message to the user here
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (imageId: string) => {
    try {
      // First get the image record to get the file path
      const { data: imageData, error: fetchError } = await supabase
        .from('listing_images')
        .select('url')
        .eq('id', imageId)
        .single()

      if (fetchError) throw fetchError

      // Delete from storage if URL exists
      if (imageData?.url) {
        const fileName = imageData.url.split('/').pop()
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('listing-images')
            .remove([`${listingId}/${fileName}`])

          if (storageError) {
            console.error('Storage delete error:', storageError)
          }
        }
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from('listing_images')
        .delete()
        .eq('id', imageId)

      if (dbError) throw dbError
      
      router.refresh()
    } catch (err) {
      console.error('Error deleting image:', err)
      // You might want to show a toast or error message to the user here
    }
  }

  return (
    <div className="space-y-6">
      <ImageUploader onUpload={handleUpload} loading={loading} />

      <ImageGrid 
        images={images}
        onDelete={handleDelete}
      />
    </div>
  )
} 