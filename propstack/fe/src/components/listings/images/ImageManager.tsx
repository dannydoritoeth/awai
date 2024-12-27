'use client'

import { useState } from 'react'
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

interface UploadProgress {
  total: number
  completed: number
}

export function ImageManager({ listingId, images: initialImages }: ImageManagerProps) {
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState(initialImages)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  const handleUpload = async (files: FileList) => {
    setLoading(true)
    setUploadProgress({ total: files.length, completed: 0 })

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
        
        console.log('Uploading file:', fileName)

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

        // Create database record with just the file path
        const { data, error: dbError } = await supabase
          .from('listing_images')
          .insert({
            listing_id: listingId,
            url: fileName, // Store just the file path
            order_index: images.length + 1
          })
          .select()
          .single()

        if (dbError) {
          console.error('Database insert error:', dbError)
          throw dbError
        }

        // Update progress
        setUploadProgress(prev => prev ? {
          ...prev,
          completed: prev.completed + 1
        } : null)

        return data
      })

      const uploadedImages = await Promise.all(uploads)
      // Filter out any undefined results and add all new images at once
      const newImages = uploadedImages.filter(Boolean)
      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages])
      }

      toast.success('Images uploaded successfully')
    } catch (err) {
      console.error('Error uploading images:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload images')
    } finally {
      setLoading(false)
      setUploadProgress(null)
    }
  }

  const handleDelete = async (imageId: string) => {
    try {
      // Optimistically remove the image from UI first
      setImages(prev => prev.filter(img => img.id !== imageId))

      // Get the image record
      const { data: imageData, error: fetchError } = await supabase
        .from('listing_images')
        .select('url')
        .eq('id', imageId)
        .single()

      if (fetchError) {
        console.error('Error fetching image record:', fetchError)
        throw fetchError
      }

      if (!imageData?.url) {
        console.error('No URL found for image:', imageId)
        throw new Error('Image URL not found')
      }

      // The URL in the database is now just the file path
      const filePath = imageData.url
      console.log('Attempting to delete file:', filePath)

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('listing-images')
        .remove([filePath])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        // Continue with database deletion even if storage deletion fails
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from('listing_images')
        .delete()
        .eq('id', imageId)

      if (dbError) {
        console.error('Database delete error:', dbError)
        throw dbError
      }
      
      toast.success('Image deleted successfully')
    } catch (err) {
      console.error('Error deleting image:', err)
      toast.error('Failed to delete image')
      // If deletion fails, revert the optimistic update
      setImages(initialImages)
    }
  }

  return (
    <div className="space-y-6">
      <ImageUploader 
        onUpload={handleUpload} 
        loading={loading} 
      />

      {uploadProgress && (
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700 drop-shadow-sm">
              Uploading {uploadProgress.completed} of {uploadProgress.total} images
            </span>
          </div>
        </div>
      )}

      <ImageGrid 
        images={images}
        onDelete={handleDelete}
      />
    </div>
  )
} 