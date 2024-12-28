'use client'

import { useEffect, useState, use, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface AIImageEditorPageProps {
  params: Promise<{
    id: string
  }>
}

type EditMode = 'inpaint' | 'erase'

const AIImageEditorPage = ({ params }: AIImageEditorPageProps) => {
  const { id: listingId } = use(params)
  const searchParams = useSearchParams()
  const imageId = searchParams.get('imageId')
  const [image, setImage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('inpaint')
  const [brushSize, setBrushSize] = useState(50)
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const router = useRouter()

  // Canvas refs
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Initialize canvas when image loads
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

  // Initialize canvas when image loads
  useEffect(() => {
    console.log('SignedUrl changed:', signedUrl)
    if (!signedUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous' // Set crossOrigin before src
    img.src = signedUrl
    
    console.log('Loading image...')
    img.onload = () => {
      console.log('Image loaded:', img.width, 'x', img.height)
      if (!canvasRef.current || !maskCanvasRef.current) {
        console.error('Canvas refs not ready')
        return
      }

      // Calculate size to maintain aspect ratio and fit container
      const maxWidth = 800
      const maxHeight = 600
      const containerWidth = canvasRef.current.parentElement?.clientWidth || maxWidth
      
      let width = img.width
      let height = img.height
      const aspectRatio = width / height

      // Scale down if image is too large
      if (width > containerWidth) {
        width = containerWidth
        height = width / aspectRatio
      }
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      console.log('Canvas size:', width, 'x', height)

      // Set canvas sizes
      setCanvasSize({ width, height })
      canvasRef.current.width = width
      canvasRef.current.height = height
      maskCanvasRef.current.width = width
      maskCanvasRef.current.height = height

      // Initialize both canvases
      const ctx = canvasRef.current.getContext('2d')
      const maskCtx = maskCanvasRef.current.getContext('2d')

      if (!ctx || !maskCtx) {
        console.error('Could not get canvas contexts')
        return
      }

      // Clear both canvases
      ctx.clearRect(0, 0, width, height)
      maskCtx.clearRect(0, 0, width, height)

      // Draw image on main canvas
      ctx.drawImage(img, 0, 0, width, height)
      console.log('Image drawn on canvas')
    }

    img.onerror = (e) => {
      console.error('Error loading image:', e)
    }
  }, [signedUrl])

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

  if (!image || !signedUrl) {
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
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  {signedUrl && (
                    <>
                      <img 
                        ref={imageRef}
                        src={signedUrl}
                        alt="Selected image"
                        className="w-full h-auto"
                        crossOrigin="anonymous"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setCanvasSize({ 
                            width: img.clientWidth, 
                            height: img.clientHeight 
                          });
                        }}
                      />
                      <canvas
                        ref={maskCanvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
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
                    </>
                  )}
                </div>
                <div className="mt-4">
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

export default AIImageEditorPage 