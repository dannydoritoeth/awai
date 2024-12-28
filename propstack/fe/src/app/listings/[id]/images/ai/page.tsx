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
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [wasImageResized, setWasImageResized] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('inpaint')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  // Add state for drawing
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(50)
  const [scale, setScale] = useState(100)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

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
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
  }

  const getMaskDataUrl = () => {
    if (!maskCanvasRef.current) return null
    return maskCanvasRef.current.toDataURL('image/png')
  }

  // Initialize image processing
  useEffect(() => {
    if (!imageId) {
      router.push(`/listings/${listingId}/images`)
      return
    }

    const fetchImage = async () => {
      console.log('Fetching image data...')
      const { data, error } = await supabase
        .from('listing_images')
        .select('*')
        .eq('id', imageId)
        .single()

      if (error) {
        console.error('Error fetching image:', error)
        router.push(`/listings/${listingId}/images`)
        return
      }

      console.log('Image data:', data)
      setImage(data)

      // Get signed URL for the image
      console.log('Getting signed URL for:', data.url)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('listing-images')
        .createSignedUrl(data.url, 3600)

      if (signedUrlError) {
        console.error('Error getting signed URL:', signedUrlError)
        return
      }

      console.log('Signed URL:', signedUrlData.signedUrl)
      setSignedUrl(signedUrlData.signedUrl)
      setLoading(false)
    }

    fetchImage()
  }, [imageId, listingId, router])

  // Process image when signedUrl changes
  useEffect(() => {
    if (!signedUrl) return

    const loadAndProcessImage = async () => {
      try {
        // Load the original image
        const img = new Image()
        const imgLoaded = new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })
        img.crossOrigin = 'anonymous'
        img.src = signedUrl
        await imgLoaded

        console.log('Original image loaded:', img.width, 'x', img.height)

        // Create canvas for conversion/resizing
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Scale down if needed while maintaining aspect ratio
        const MAX_WIDTH = 2048
        const MAX_HEIGHT = 2048
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
          setWasImageResized(true)
          console.log('Image resized to:', width, 'x', height)
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to PNG and check size
        const pngBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to convert image'))
            },
            'image/png',
            1.0
          )
        })

        console.log('Converted PNG size:', Math.round(pngBlob.size / 1024 / 1024 * 100) / 100, 'MB')

        // Check if size is over 4MB
        if (pngBlob.size > 4 * 1024 * 1024) {
          throw new Error('Image is too large for AI editing (max 4MB). Please try a smaller image.')
        }

        // Create object URL for the processed image
        const processedImageUrl = URL.createObjectURL(pngBlob)
        setProcessedUrl(processedImageUrl)
        setLoading(false)

        console.log('Image processed and ready')
      } catch (err) {
        console.error('Error processing image:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to process image')
        router.push(`/listings/${listingId}/images`)
      }
    }

    loadAndProcessImage()
  }, [signedUrl, listingId, router])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (processedUrl) {
        URL.revokeObjectURL(processedUrl)
      }
    }
  }, [processedUrl])

  // Add canvas setup when image loads
  useEffect(() => {
    if (!processedUrl || !maskCanvasRef.current) return

    const img = new Image()
    img.onload = () => {
      setCanvasSize({
        width: img.width,
        height: img.height
      })

      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = img.width
        maskCanvasRef.current.height = img.height
      }
    }
    img.src = processedUrl
  }, [processedUrl])

  const handleGenerate = async () => {
    if (!description) {
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
          description,
        }
      })

      if (error) throw error

      // Refresh the image list
      router.refresh()
      router.push(`/listings/${listingId}/images`)
    } catch (err) {
      console.error('Error generating image:', err)
      alert('Failed to generate image. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

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

  if (!image || !processedUrl) {
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
                {wasImageResized && (
                  <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-lg">
                    Note: Your image has been automatically resized to optimize for AI processing.
                  </div>
                )}
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  {processedUrl && (
                    <div className="relative">
                      <div style={{ maxWidth: `${scale}%` }}>
                        <img 
                          src={processedUrl}
                          alt="Selected image"
                          className="w-full h-auto"
                          crossOrigin="anonymous"
                        />
                        <canvas
                          ref={maskCanvasRef}
                          className="absolute inset-0 cursor-crosshair"
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
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Image Scale
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={scale}
                          onChange={(e) => setScale(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {scale}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
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
                      className="px-4 py-2 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-md"
                    >
                      Reset mask
                    </button>
                  </div>
                </div>
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
                  <p className="text-sm text-gray-600">
                    Use the brush tool on the left to paint over the areas you want to change
                  </p>
                </div>

                {/* Step 4: Description */}
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

                {/* Step 5: Generate */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 5: Generate your image</h3>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !description}
                    className={`w-full py-3 rounded-md text-white ${
                      generating || !description
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