'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from './ImageUploader'
import { ImageGrid } from './ImageGrid'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

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
      // First check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please sign in to upload images')
        return
      }

      const uploads = Array.from(files).map(async (file) => {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('File size must be less than 5MB')
        }

        // Clean the file name to prevent URL issues
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${listingId}/${Date.now()}-${cleanFileName}`
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          throw uploadError
        }

        // Store just the file path in the database
        const { error: dbError } = await supabase
          .from('listing_images')
          .insert({
            listing_id: listingId,
            url: fileName,  // Store just the file path
            order_index: images.length + 1
          })

        if (dbError) {
          console.error('Database insert error:', dbError)
          throw dbError
        }
      })

      await Promise.all(uploads)
      toast.success('Images uploaded successfully')
      router.refresh()
    } catch (err) {
      console.error('Error uploading images:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload images')
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
        const { error: storageError } = await supabase.storage
          .from('listing-images')
          .remove([imageData.url])  // URL is already just the file path

        if (storageError) {
          console.error('Storage delete error:', storageError)
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
      toast.error('Failed to delete image')
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