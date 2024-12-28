'use client'

import { useState } from 'react'
import { ImageUploader } from './ImageUploader'
import { ImageGrid } from './ImageGrid'
import { CaptionDialog, CaptionOptions } from './CaptionDialog'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface ImageManagerProps {
  listingId: string
  images: Array<{
    id: string
    url: string
    order_index: number
    caption?: string
  }>
}

interface UploadProgress {
  total: number
  completed: number
}

interface CaptionProgress extends UploadProgress {
  currentBatch: number
  totalBatches: number
}

interface ImageWithUrl {
  id: string
  url: string
}

interface ImageWithCaption extends ImageWithUrl {
  caption: string
}

export function ImageManager({ listingId, images: initialImages }: ImageManagerProps) {
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState(initialImages)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [captionProgress, setCaptionProgress] = useState<CaptionProgress | null>(null)
  const [showCaptionDialog, setShowCaptionDialog] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ImageManagerProps['images'][0] | null>(null)

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

  const handleTransform = async (imageId: string, type: 'enhance' | 'relight' | 'upscale') => {
    // Implementation will come later
    toast.error('Image transformation not implemented yet')
  }

  const handleGenerateCaptions = async (options: CaptionOptions) => {
    if (images.length === 0) {
      toast.error('No images to generate captions for')
      return
    }

    setGeneratingCaptions(true)
    setCaptionProgress({
      total: images.length,
      completed: 0,
      currentBatch: 0,
      totalBatches: images.length
    })

    try {
      // Process one image at a time
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        
        // Generate caption for single image
        const { data, error } = await supabase.functions.invoke('generate-image-caption', {
          body: { 
            listingId,
            imageIds: [image.id],
            options: {
              style: options.style,
              focus: options.focus,
              tone: options.tone,
              length: options.length,
              includeKeywords: options.includeKeywords || ''
            }
          }
        })

        if (error) {
          console.error('Error generating caption for image:', image.id, error)
          continue // Skip this image but continue with others
        }

        // Fetch the updated caption
        const { data: updatedImage, error: fetchError } = await supabase
          .from('listing_images')
          .select('id, caption')
          .eq('id', image.id)
          .single()

        if (fetchError) {
          console.error('Error fetching updated caption:', fetchError)
          continue
        }

        // Update local state with new caption
        if (updatedImage?.caption) {
          setImages(prev => 
            prev.map(img => 
              img.id === image.id ? { ...img, caption: updatedImage.caption } : img
            )
          )
        }

        // Update progress
        setCaptionProgress(prev => prev ? {
          ...prev,
          completed: i + 1,
          currentBatch: i + 1
        } : null)
      }

      toast.success('Generated captions for all images')
    } catch (err) {
      console.error('Error generating captions:', err)
      toast.error('Failed to generate captions')
    } finally {
      setGeneratingCaptions(false)
      setCaptionProgress(null)
    }
  }

  const handleCaptionUpdate = async (imageId: string, caption: string) => {
    try {
      const { error } = await supabase
        .from('listing_images')
        .update({ caption })
        .eq('id', imageId)

      if (error) throw error

      // Update local state
      setImages(prev => 
        prev.map(img => 
          img.id === imageId ? { ...img, caption } : img
        )
      )

      toast.success('Caption updated successfully')
    } catch (err) {
      console.error('Error updating caption:', err)
      toast.error('Failed to update caption')
    }
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedImage) return

    const currentIndex = images.findIndex(img => img.id === selectedImage.id)
    if (currentIndex === -1) return

    let nextIndex: number
    if (direction === 'next') {
      nextIndex = currentIndex + 1
    } else {
      nextIndex = currentIndex - 1
    }

    if (nextIndex >= 0 && nextIndex < images.length) {
      setSelectedImage(images[nextIndex])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Listing Images</h2>
        <button
          onClick={() => setShowCaptionDialog(true)}
          disabled={generatingCaptions || images.length === 0}
          className={`
            inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
            ${generatingCaptions || images.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }
          `}
        >
          <SparklesIcon className="w-4 h-4 mr-2" />
          {generatingCaptions 
            ? `Generating Captions (${captionProgress?.completed || 0}/${captionProgress?.total || 0})`
            : 'Generate AI Captions'
          }
        </button>
      </div>

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

      {captionProgress && (
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${(captionProgress.completed / captionProgress.total) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700 drop-shadow-sm">
              Generating captions: {captionProgress.completed} of {captionProgress.total} 
            </span>
          </div>
        </div>
      )}

      <ImageGrid 
        images={images}
        onDelete={handleDelete}
        onCaptionUpdate={handleCaptionUpdate}
        onOpenAIEdit={() => setShowCaptionDialog(true)}
      />

      <CaptionDialog
        isOpen={showCaptionDialog}
        onClose={() => setShowCaptionDialog(false)}
        onGenerate={handleGenerateCaptions}
        imageCount={images.length}
      />
    </div>
  )
} 