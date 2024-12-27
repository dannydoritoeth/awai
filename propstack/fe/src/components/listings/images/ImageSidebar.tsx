import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, SparklesIcon, PencilIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface ImageSidebarProps {
  image: {
    id: string
    url: string
    caption?: string
  } | null
  onClose: () => void
  onTransform?: (imageId: string, type: 'enhance' | 'relight' | 'upscale') => Promise<void>
  onCaptionUpdate?: (imageId: string, caption: string) => Promise<void>
  onNavigate?: (direction: 'prev' | 'next') => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function ImageSidebar({ 
  image, 
  onClose, 
  onTransform, 
  onCaptionUpdate,
  onNavigate,
  hasPrevious = false,
  hasNext = false
}: ImageSidebarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [caption, setCaption] = useState('')
  const [transforming, setTransforming] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end of text
      const length = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(length, length)
    }
  }, [isEditing, image?.id])

  // Get signed URL and update caption when image changes
  useEffect(() => {
    if (!image) return

    // Clear previous image and show loading state
    setSignedUrl(null)
    setIsLoading(true)

    // Update caption when image changes
    setCaption(image.caption || '')
    // Auto-open caption editor when navigating
    setIsEditing(true)

    supabase.storage
      .from('listing-images')
      .createSignedUrl(image.url, 3600)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error creating signed URL:', error)
          return
        }
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [image])

  const handleSave = async (andNext: boolean = false) => {
    if (!image || !onCaptionUpdate) return
    setIsSaving(true)
    try {
      await onCaptionUpdate(image.id, caption)
      if (andNext && onNavigate && hasNext) {
        onNavigate('next')
      } else {
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving caption:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!image) return null

  return (
    <div className="fixed inset-y-0 right-0 w-[800px] bg-white shadow-xl border-l border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Image Editor</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate?.('prev')}
              disabled={!hasPrevious}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onNavigate?.('next')}
              disabled={!hasNext}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-500 rounded-full"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Image Preview */}
          <div className="relative w-full aspect-[4/3] bg-gray-50 rounded-lg">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : signedUrl ? (
              <div 
                className="relative w-full h-full cursor-pointer"
                onClick={() => setShowLightbox(true)}
              >
                <img
                  src={signedUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 pointer-events-none">
                </div>

                <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg p-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowLightbox(true)
                    }}
                    className="p-1 text-white hover:text-gray-200"
                    title="View full size"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 4v3m4-3h3m-3-4V7m-4 4H7" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <span>Failed to load image</span>
              </div>
            )}
          </div>

          {/* Tools and Options */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Transform Actions */}
            {onTransform && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Transform Image</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      setTransforming(true)
                      try {
                        await onTransform(image.id, 'enhance')
                      } finally {
                        setTransforming(false)
                      }
                    }}
                    disabled={transforming}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    Enhance
                  </button>
                  <button
                    onClick={async () => {
                      setTransforming(true)
                      try {
                        await onTransform(image.id, 'relight')
                      } finally {
                        setTransforming(false)
                      }
                    }}
                    disabled={transforming}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    Relight
                  </button>
                  <button
                    onClick={async () => {
                      setTransforming(true)
                      try {
                        await onTransform(image.id, 'upscale')
                      } finally {
                        setTransforming(false)
                      }
                    }}
                    disabled={transforming}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    Upscale
                  </button>
                </div>
              </div>
            )}

            {/* Right Column - Caption */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-900">Caption</h4>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-gray-400 hover:text-gray-500 rounded-full"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter image caption..."
                    ref={textareaRef}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setCaption(image.caption || '')
                        setIsEditing(false)
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={isSaving}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    {hasNext && (
                      <button
                        onClick={() => handleSave(true)}
                        disabled={isSaving}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save & Next'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">
                  {image.caption || 'No caption yet'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && signedUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img
            src={signedUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
} 