'use client'

import { useEffect, useState, useRef } from 'react'
import { use } from 'react'
import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'

interface AIImageEditorPageProps {
  params: Promise<{
    id: string
  }>
}

type EditMode = 'inpaint' | 'erase'

export default function AIImageEditorPage({ params }: AIImageEditorPageProps) {
  const { id: listingId } = use(params)
  const searchParams = useSearchParams()
  const imageId = searchParams.get('imageId')
  const [image, setImage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [wasImageResized, setWasImageResized] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('inpaint')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(50)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Add state for alternatives
  const [alternatives, setAlternatives] = useState<any[]>([])
  const [keyImageId, setKeyImageId] = useState<string | null>(null)

  // Process and upload image
  const processAndUploadImage = async (originalUrl: string): Promise<string> => {
    try {
      // Load the original image
      const response = await fetch(originalUrl)
      const blob = await response.blob()
      
      // Create an image element
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      })

      // Create canvas for processing
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Scale down if needed while maintaining aspect ratio
      const MAX_SIZE = 2048
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        setWasImageResized(true)
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      // Draw image
      ctx.drawImage(img, 0, 0, width, height)

      // Try different quality levels until we get under 4MB
      let quality = 1.0
      let pngBlob: Blob | null = null
      const MAX_SIZE_BYTES = 4 * 1024 * 1024

      while (quality >= 0.1) {
        // Convert to PNG with current quality
        pngBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (blob) => resolve(blob!),
            'image/png',
            quality
          )
        })

        if (pngBlob.size <= MAX_SIZE_BYTES) break

        // If still too large, reduce dimensions by 10%
        if (quality === 0.1) {
          width = Math.round(width * 0.9)
          height = Math.round(height * 0.9)
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          quality = 1.0 // Reset quality and try again with smaller dimensions
          setWasImageResized(true)
        } else {
          // Reduce quality by 0.1
          quality = Math.max(0.1, quality - 0.1)
        }
      }

      if (!pngBlob || pngBlob.size > MAX_SIZE_BYTES) {
        throw new Error('Unable to process image to under 4MB while maintaining quality')
      }

      // Upload to Supabase
      const filename = `${imageId}_processed.png`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(`ai_processed/${filename}`, pngBlob, {
          contentType: 'image/png',
          upsert: true
        })

      if (uploadError) throw uploadError

      return uploadData.path
    } catch (err) {
      console.error('Error processing image:', err)
      throw err
    }
  }

  // Check if processed version exists
  const checkProcessedImage = async (imageId: string): Promise<string | null> => {
    try {
      const filename = `${imageId}_processed.png`
      const { data } = await supabase.storage
        .from('listing-images')
        .list('ai_processed', {
          search: filename
        })

      if (data && data.length > 0) {
        const { data: urlData } = await supabase.storage
          .from('listing-images')
          .createSignedUrl(`ai_processed/${filename}`, 3600)
        
        return urlData?.signedUrl || null
      }
      return null
    } catch (err) {
      console.error('Error checking processed image:', err)
      return null
    }
  }

  // Initialize image
  useEffect(() => {
    if (!imageId) {
      router.push(`/listings/${listingId}/images`)
      return
    }

    const initImage = async () => {
      try {
        // Get original image data
        const { data: imageData, error: imageError } = await supabase
          .from('listing_images')
          .select('*')
          .eq('id', imageId)
          .single()

        if (imageError) throw imageError
        setImage(imageData)
        setLoading(false)

        // Check for existing processed version
        const existingProcessedUrl = await checkProcessedImage(imageId)
        if (existingProcessedUrl) {
          setProcessedUrl(existingProcessedUrl)
          return
        }

        // If no processed version exists, start processing
        setProcessing(true)
        
        // Get signed URL for the original image
        const { data: urlData, error: urlError } = await supabase.storage
          .from('listing-images')
          .createSignedUrl(imageData.url, 3600)

        if (urlError) throw urlError

        // Process and upload the image
        const processedPath = await processAndUploadImage(urlData.signedUrl)

        // Get signed URL for the processed image
        const { data: processedUrlData, error: processedUrlError } = await supabase.storage
          .from('listing-images')
          .createSignedUrl(processedPath, 3600)

        if (processedUrlError) throw processedUrlError

        setProcessedUrl(processedUrlData.signedUrl)
        setProcessing(false)
      } catch (err) {
        console.error('Error initializing image:', err)
        toast.error('Failed to prepare image for editing')
        router.push(`/listings/${listingId}/images`)
      }
    }

    initImage()
  }, [imageId, listingId, router])

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    draw(e)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !maskCanvasRef.current) return

    const canvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.fillStyle = editMode === 'inpaint' ? 'rgba(0, 0, 255, 0.3)' : 'rgba(255, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const resetMask = () => {
    if (!maskCanvasRef.current) return
    const ctx = maskCanvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
  }

  const getMaskDataUrl = () => {
    if (!maskCanvasRef.current) return null
    return maskCanvasRef.current.toDataURL('image/png')
  }

  // Set up canvas when processed image is ready
  useEffect(() => {
    if (!processedUrl || !maskCanvasRef.current) return

    const img = new Image()
    img.onload = () => {
      const MAX_HEIGHT = 800
      let width = img.width
      let height = img.height

      if (height > MAX_HEIGHT) {
        const aspectRatio = width / height
        height = MAX_HEIGHT
        width = Math.round(height * aspectRatio)
      }

      setCanvasSize({ width, height })

      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = img.width
        maskCanvasRef.current.height = img.height
      }
    }
    img.src = processedUrl
  }, [processedUrl])

  // Handle generate
  const handleGenerate = async () => {
    if (editMode === 'inpaint' && !description) {
      alert('Please describe the changes you want to make')
      return
    }

    const maskDataUrl = getMaskDataUrl()
    if (!maskDataUrl) {
      alert('Please draw a mask on the image')
      return
    }

    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('edit-image', {
        body: {
          imageId,
          listingId,
          mask: maskDataUrl,
          mode: editMode,
          description: editMode === 'inpaint' ? description : undefined,
        }
      })

      if (error) throw error

      // Add the new image to alternatives without creating a record
      setAlternatives(prev => [...prev, {
        signedUrl: data.image.signedUrl,
        listing_id: listingId,
        is_generated: true
      }])
      
      // Reset the mask
      resetMask()
      
      // Clear the description if in inpaint mode
      if (editMode === 'inpaint') {
        setDescription('')
      }
      
      toast.success('Image generated successfully!')
    } catch (err) {
      console.error('Error generating image:', err)
      toast.error('Failed to generate image. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Fetch alternatives on load
  useEffect(() => {
    if (!imageId || !processedUrl) return

    const fetchAlternatives = async () => {
      const { data, error } = await supabase
        .from('listing_images')
        .select('*')
        .eq('listing_id', listingId)
        .order('order_index')

      if (!error && data) {
        // Get signed URLs for all images except the processed one
        const imagesWithUrls = await Promise.all(
          data.map(async (img) => {
            // If this is the current image, use the processed URL
            if (img.id === imageId) {
              return {
                ...img,
                signedUrl: processedUrl
              }
            }
            // Otherwise get a signed URL for the original image
            const { data: urlData } = await supabase.storage
              .from('listing-images')
              .createSignedUrl(img.url, 3600)
            return {
              ...img,
              signedUrl: urlData?.signedUrl
            }
          })
        )
        setAlternatives(imagesWithUrls)
        setKeyImageId(imageId)
      }
    }

    fetchAlternatives()
  }, [imageId, listingId, processedUrl])

  // Handle setting key image
  const handleSetKeyImage = async (alt: any) => {
    setKeyImageId(alt.id)
    
    try {
      // If this is a generated image that hasn't been saved yet
      if (!alt.id) {
        // Upload to Supabase Storage
        const response = await fetch(alt.signedUrl)
        const blob = await response.blob()
        const fileName = `${listingId}/${Date.now()}-edited.png`
        
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            cacheControl: '3600',
          })

        if (uploadError) throw uploadError

        // Create new image record
        const { data: newImage, error: dbError } = await supabase
          .from('listing_images')
          .insert({
            listing_id: listingId,
            url: fileName,
            order_index: 999, // Add to end
          })
          .select()
          .single()

        if (dbError) throw dbError

        // Update alternatives list with the new image
        setAlternatives(prev => 
          prev.map(img => 
            img.signedUrl === alt.signedUrl 
              ? { ...newImage, signedUrl: alt.signedUrl, is_key: true }
              : { ...img, is_key: false }
          )
        )

        toast.success('Image saved successfully!')
      } else {
        // Just update the UI for existing images
        setAlternatives(prev => 
          prev.map(img => ({
            ...img,
            is_key: img.id === alt.id
          }))
        )
      }
    } catch (err) {
      console.error('Error saving image:', err)
      toast.error('Failed to save image. Please try again.')
    }
  }

  // Update alternatives after generation
  useEffect(() => {
    if (!generating) {
      // Refresh alternatives list after generation
      const fetchAlternatives = async () => {
        const { data, error } = await supabase
          .from('listing_images')
          .select('*')
          .eq('listing_id', listingId)
          .order('order_index')

        if (!error && data) {
          setAlternatives(data)
        }
      }

      fetchAlternatives()
    }
  }, [generating, listingId])

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
          <div className="flex gap-8">
            {/* Left side - Image Editor (2/3) */}
            <div className="flex-grow w-2/3">
              <div className="bg-white rounded-lg shadow-sm p-6">
                {processing ? (
                  <div className="p-4 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-600">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-sm">Processing image for AI editing</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This may take a few moments</p>
                  </div>
                ) : (
                  <>
                    {wasImageResized && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 text-sm text-blue-700 rounded-lg">
                        Note: Your image has been automatically resized to optimize for AI processing.
                      </div>
                    )}
                    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                      {processedUrl && (
                        <div className="relative">
                          <div style={{ 
                            width: canvasSize.width ? `${canvasSize.width}px` : 'auto',
                            height: canvasSize.height ? `${canvasSize.height}px` : 'auto',
                            maxHeight: '800px',
                          }}>
                            <img 
                              src={processedUrl}
                              alt="Selected image"
                              className="absolute top-0 left-0 w-full h-full"
                              crossOrigin="anonymous"
                            />
                            <canvas
                              ref={maskCanvasRef}
                              className="absolute top-0 left-0 cursor-crosshair"
                              style={{
                                width: '100%',
                                height: '100%'
                              }}
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alternatives List */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Alternative Versions</h4>
                      <div className="flex items-start gap-4 overflow-x-auto pb-4">
                        {alternatives.map((alt) => {
                          const isKeyImage = alt.id === keyImageId
                          return (
                            <div 
                              key={alt.id} 
                              className={`relative flex-shrink-0 group ${
                                isKeyImage ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                              }`}
                            >
                              <div className="w-32 h-32 relative bg-gray-100 rounded-lg">
                                {alt.signedUrl && (
                                  <img
                                    src={alt.signedUrl}
                                    alt={isKeyImage ? "Key image" : "Alternative version"}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                )}
                                {isKeyImage && (
                                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                    Key Image
                                  </div>
                                )}
                              </div>
                              {!isKeyImage && (
                                <button
                                  onClick={() => handleSetKeyImage(alt)}
                                  className="absolute inset-x-0 bottom-0 p-2 bg-black bg-opacity-50 text-white text-xs rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Set as key
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right side - Controls (1/3) */}
            <div className="w-1/3 space-y-6">
              {/* Credits Counter */}
              <div className="text-sm text-gray-600 text-right">
                ⚡ 961 image credits remaining
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                {/* Step 1: Image Selection */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 1: Select the image you want to edit</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-green-600">
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Ready to edit
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-700">
                      Change Image
                    </button>
                  </div>
                </div>

                {/* Step 2: Edit Mode */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 2: Choose your edit mode</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setEditMode('inpaint')}
                      className={`flex-1 px-4 py-2 rounded-md ${
                        editMode === 'inpaint'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Inpaint (3 credits)
                    </button>
                    <button
                      onClick={() => setEditMode('erase')}
                      className={`flex-1 px-4 py-2 rounded-md ${
                        editMode === 'erase'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Erase (3 credits)
                    </button>
                  </div>
                </div>

                {/* Step 3: Masking */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 3: Mask the areas/items you want to change</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Use the brush tool to paint over the areas you want to change
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brush Size
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {brushSize}px
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={resetMask}
                      className="w-full px-4 py-2 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-md"
                    >
                      Reset mask
                    </button>
                  </div>
                </div>

                {/* Step 4: Description */}
                {editMode === 'inpaint' && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Step 4: Describe the changes you want AI to make</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Change description <span className="text-rose-600">(Draw on image first)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="For best results describe colors, materials, style, etc."
                        className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Generate */}
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Step {editMode === 'inpaint' ? '5' : '4'}: Generate your image
                  </h3>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || (editMode === 'inpaint' && !description)}
                    className={`w-full py-3 rounded-md text-white ${
                      generating || (editMode === 'inpaint' && !description)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {generating ? 'Generating...' : 'Generate →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 