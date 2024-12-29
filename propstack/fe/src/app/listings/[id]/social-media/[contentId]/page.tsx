"use client"

import { PageHeading } from "@/components/layout/PageHeading"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FacebookIcon, TwitterIcon, InstagramIcon, LinkedinIcon } from "@/components/icons/social"
import { supabase } from "@/lib/supabase"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { ImageGrid } from "@/components/listings/images/ImageGrid"
import { RadioGroup } from "@headlessui/react"
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import debounce from 'lodash/debounce'
import toast from 'react-hot-toast'

interface ContentDetailPageProps {
  params: Promise<{
    id: string
    contentId: string
  }>
}

const POST_TYPES = [
  { value: "new_listing", label: "New Listing Announcement" },
  { value: "price_update", label: "Price Update" },
  { value: "open_house", label: "Open House" },
  { value: "just_sold", label: "Just Sold" },
  { value: "custom", label: "Custom" }
]

interface PlatformOptions {
  organic: boolean
  ad: boolean
}

type Platform = "facebook" | "instagram" | "twitter" | "linkedin"

interface GenerationOptions {
  post_type: string
  customContext: string
  agentContext: string
  tone: string
  useEmojis: boolean
  contentLength: "short" | "medium" | "long"
  callToAction: {
    type: "learn_more" | "contact" | "schedule" | "custom"
    customText?: string
    link?: string
  }
  platforms: Platform[]
  generateAdCopy: boolean
  selectedPlatforms: {
    [key in Platform]: PlatformOptions
  }
}

interface ListingImage {
  id: string
  url: string
  order_index: number
  caption?: string
}

interface ImageWithSignedUrl {
  id: string
  signedUrl?: string
  isLoading: boolean
  isImageLoaded?: boolean
}

// Add platform-specific image dimensions
const PLATFORM_IMAGE_SIZES = {
  facebook: { width: 1200, height: 630 },
  instagram: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 }
} as const

// Add function to resize image for platform
const resizeImageForPlatform = async (imageUrl: string, platform: Platform): Promise<string> => {
  const { width: targetWidth, height: targetHeight } = PLATFORM_IMAGE_SIZES[platform]
  
  // Load the image
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.crossOrigin = "anonymous"
    img.src = imageUrl
  })

  // Create canvas with device pixel ratio for better quality
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  // Set canvas size to target dimensions
  canvas.width = targetWidth
  canvas.height = targetHeight

  // Calculate dimensions preserving aspect ratio
  let scaledWidth = img.width
  let scaledHeight = img.height
  let x = 0
  let y = 0

  const targetRatio = targetWidth / targetHeight
  const imageRatio = img.width / img.height

  if (imageRatio > targetRatio) {
    // Image is wider than target: scale to target height
    scaledHeight = targetHeight
    scaledWidth = scaledHeight * imageRatio
    x = -(scaledWidth - targetWidth) / 2
  } else {
    // Image is taller than target: scale to target width
    scaledWidth = targetWidth
    scaledHeight = scaledWidth / imageRatio
    y = -(scaledHeight - targetHeight) / 2
  }

  // Fill background with white
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Draw image with high-quality settings
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  // Draw the image centered
  ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

  // Convert to blob with high quality
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.95)
  })

  return URL.createObjectURL(blob)
}

export default function ContentDetailPage({ params }: ContentDetailPageProps) {
  const { id, contentId } = use(params)
  const router = useRouter()
  const [listing, setListing] = useState<any>(null)
  const [content, setContent] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    post_type: "new_listing",
    customContext: "",
    agentContext: "",
    tone: "professional",
    useEmojis: true,
    contentLength: "medium",
    callToAction: {
      type: "learn_more",
      customText: "",
      link: ""
    },
    platforms: ["facebook", "instagram", "twitter", "linkedin"],
    generateAdCopy: false,
    selectedPlatforms: {
      facebook: { organic: true, ad: false },
      instagram: { organic: true, ad: false },
      twitter: { organic: true, ad: false },
      linkedin: { organic: true, ad: false }
    }
  })
  const [listingImages, setListingImages] = useState<ListingImage[]>([])
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [heroImage, setHeroImage] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, ImageWithSignedUrl>>({})
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [listingRes, contentRes, imagesRes] = await Promise.all([
          supabase
            .from("listings")
            .select("*")
            .eq("id", id)
            .single(),
          supabase
            .from("social_media_content")
            .select("*")
            .eq("id", contentId)
            .single(),
          supabase
            .from("listing_images")
            .select("*")
            .eq("listing_id", id)
            .order("order_index")
        ])

        if (listingRes.error) {
          console.error("Error fetching listing:", listingRes.error)
          return
        }
        if (contentRes.error) {
          console.error("Error fetching content:", contentRes.error)
          return
        }
        if (imagesRes.error) {
          console.error("Error fetching images:", imagesRes.error)
          return
        }

        setListing(listingRes.data)
        setContent(contentRes.data)
        setListingImages(imagesRes.data)

        // If content already has selected images, set them
        if (contentRes.data.selected_images) {
          setSelectedImages(contentRes.data.selected_images)
          setHeroImage(contentRes.data.hero_image)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [id, contentId])

  useEffect(() => {
    listingImages.forEach(image => {
      if (!signedUrls[image.id]) {
        setSignedUrls(prev => ({
          ...prev,
          [image.id]: { id: image.id, isLoading: true, isImageLoaded: false }
        }))

        // Try to get from cache first
        const cacheKey = `image-${image.id}`
        caches.open('image-cache').then(cache => 
          cache.match(cacheKey).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse.text()
            }

            // If not in cache, get from Supabase
            return supabase.storage
              .from('listing-images')
              .createSignedUrl(image.url, 3600)
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error creating signed URL:', error)
                  return null
                }
                if (data?.signedUrl) {
                  // Store in cache
                  cache.put(cacheKey, new Response(data.signedUrl))
                  return data.signedUrl
                }
                return null
              })
          })
        ).then(signedUrl => {
          if (signedUrl) {
            setSignedUrls(prev => ({
              ...prev,
              [image.id]: {
                id: image.id,
                signedUrl,
                isLoading: false,
                isImageLoaded: false
              }
            }))
          }
        })
      }
    })

    // Clean up any signed URLs for images that no longer exist
    setSignedUrls(prev => {
      const currentImageIds = new Set(listingImages.map(img => img.id))
      const updated = { ...prev }
      Object.keys(updated).forEach(id => {
        if (!currentImageIds.has(id)) {
          delete updated[id]
        }
      })
      return updated
    })
  }, [listingImages])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const { error: fnError } = await supabase.functions.invoke(
        'generate-social-content',
        {
          body: {
            listingId: id,
            contentId: contentId,
            options: generationOptions
          }
        }
      )

      if (fnError) {
        console.error("Generation error:", fnError)
        throw fnError
      }

      const { data: updatedContent, error } = await supabase
        .from("social_media_content")
        .select("*")
        .eq("id", contentId)
        .single()

      if (error) throw error
      if (updatedContent) setContent(updatedContent)
    } catch (error) {
      console.error("Error generating content:", error)
      alert(error instanceof Error ? error.message : "Failed to generate content. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleImageSelection = async (imageId: string) => {
    setSelectedImages(prev => {
      const isSelected = prev.includes(imageId)
      if (isSelected) {
        // If removing the hero image, clear it
        if (heroImage === imageId) {
          setHeroImage(null)
        }
        return prev.filter(id => id !== imageId)
      } else {
        // If this is the first image being selected, make it the hero
        if (prev.length === 0) {
          setHeroImage(imageId)
        }
        return [...prev, imageId]
      }
    })

    // Update the content record with the new selection
    const { error } = await supabase
      .from("social_media_content")
      .update({
        selected_images: selectedImages,
        hero_image: heroImage
      })
      .eq("id", contentId)

    if (error) {
      console.error("Error updating image selection:", error)
    }
  }

  const handleHeroImageChange = async (imageId: string) => {
    // Ensure the hero image is also in selectedImages
    if (!selectedImages.includes(imageId)) {
      setSelectedImages(prev => [...prev, imageId])
    }
    setHeroImage(imageId)

    // Update the content record with the new hero image
    const { error } = await supabase
      .from("social_media_content")
      .update({
        selected_images: selectedImages,
        hero_image: imageId
      })
      .eq("id", contentId)

    if (error) {
      console.error("Error updating hero image:", error)
    }
  }

  const debouncedSaveContent = debounce(async (platform: string, text: string) => {
    try {
      const { error } = await supabase
        .from('social_media_content')
        .update({
          generated_content: {
            ...content.generated_content,
            [platform]: text
          }
        })
        .eq('id', contentId)

      if (error) throw error
    } catch (err) {
      console.error('Error saving content:', err)
      toast.error('Failed to save changes')
    }
  }, 1000)

  if (!listing || !content) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-500">Loading... {!listing ? "Waiting for listing data" : "Waiting for content data"}</p>
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
          title={content.title}
          backHref={`/listings/${id}/social-media`}
          showBackButton
        >
          {listing.address}
        </PageHeading>

        <Tabs defaultValue="generate" className="mt-6">
          <TabsList>
            <TabsTrigger value="generate">Generate Content</TabsTrigger>
            <TabsTrigger value="media">Select Media</TabsTrigger>
            <TabsTrigger value="review">Review & Edit</TabsTrigger>
            <TabsTrigger value="post">Post Content</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-medium mb-4">Generation Options</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Post Type
                    </label>
                    <select
                      value={generationOptions.post_type}
                      onChange={(e) => setGenerationOptions(prev => ({ ...prev, post_type: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      {POST_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  {generationOptions.post_type === "custom" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Post Context
                      </label>
                      <textarea
                        value={generationOptions.customContext}
                        onChange={(e) => setGenerationOptions(prev => ({ ...prev, customContext: e.target.value }))}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Provide context for your custom post..."
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent Context & Direction
                    </label>
                    <textarea
                      value={generationOptions.agentContext}
                      onChange={(e) => setGenerationOptions(prev => ({ ...prev, agentContext: e.target.value }))}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Add any specific directions or context for the AI (e.g., highlight specific features, target audience, unique selling points)"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      This helps guide the AI in generating more targeted and effective content
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Writing Tone
                    </label>
                    <select
                      value={generationOptions.tone}
                      onChange={(e) => setGenerationOptions(prev => ({ ...prev, tone: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={generationOptions.useEmojis}
                        onChange={(e) => setGenerationOptions(prev => ({ ...prev, useEmojis: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Include emojis in generated content</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Length
                    </label>
                    <select
                      value={generationOptions.contentLength}
                      onChange={(e) => setGenerationOptions(prev => ({ 
                        ...prev, 
                        contentLength: e.target.value as "short" | "medium" | "long" 
                      }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="short">Short (1-2 sentences)</option>
                      <option value="medium">Medium (2-3 sentences)</option>
                      <option value="long">Long (3-4 sentences)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Call to Action
                    </label>
                    <select
                      value={generationOptions.callToAction.type}
                      onChange={(e) => setGenerationOptions(prev => ({ 
                        ...prev, 
                        callToAction: {
                          ...prev.callToAction,
                          type: e.target.value as "learn_more" | "contact" | "schedule" | "custom"
                        }
                      }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="learn_more">Learn More</option>
                      <option value="contact">Contact Us</option>
                      <option value="schedule">Schedule Viewing</option>
                      <option value="custom">Custom CTA</option>
                    </select>

                    {generationOptions.callToAction.type === "custom" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custom Call to Action Text
                        </label>
                        <input
                          type="text"
                          value={generationOptions.callToAction.customText}
                          onChange={(e) => setGenerationOptions(prev => ({
                            ...prev,
                            callToAction: {
                              ...prev.callToAction,
                              customText: e.target.value
                            }
                          }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Enter custom call to action text..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Landing Page URL
                      </label>
                      <input
                        type="url"
                        value={generationOptions.callToAction.link}
                        onChange={(e) => setGenerationOptions(prev => ({
                          ...prev,
                          callToAction: {
                            ...prev.callToAction,
                            link: e.target.value
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="https://..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Where should users be directed when they click your call to action?
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Platforms & Content Type
                    </label>
                    <div className="space-y-3">
                      {(["facebook", "instagram", "twitter", "linkedin"] as Platform[]).map(platform => (
                        <div key={platform} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 capitalize">{platform}</span>
                          </div>
                          <div className="flex gap-4 ml-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={generationOptions.selectedPlatforms[platform].organic}
                                onChange={(e) => {
                                  setGenerationOptions(prev => ({
                                    ...prev,
                                    selectedPlatforms: {
                                      ...prev.selectedPlatforms,
                                      [platform]: {
                                        ...prev.selectedPlatforms[platform],
                                        organic: e.target.checked
                                      }
                                    },
                                    platforms: e.target.checked 
                                      ? Array.from(new Set([...prev.platforms, platform]))
                                      : prev.platforms.filter(p => p !== platform)
                                  }))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Organic Post</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={generationOptions.selectedPlatforms[platform].ad}
                                onChange={(e) => {
                                  setGenerationOptions(prev => ({
                                    ...prev,
                                    selectedPlatforms: {
                                      ...prev.selectedPlatforms,
                                      [platform]: {
                                        ...prev.selectedPlatforms[platform],
                                        ad: e.target.checked
                                      }
                                    }
                                  }))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Ad Copy</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={
                      isGenerating || 
                      Object.values(generationOptions.selectedPlatforms).every(p => !p.organic && !p.ad) ||
                      (generationOptions.post_type === "custom" && !generationOptions.customContext)
                    }
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                  >
                    {isGenerating ? "Generating..." : "Generate Content"}
                  </button>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-medium mb-4">Generated Content</h3>
                {content.generated_content ? (
                  <div className="space-y-4">
                    {Object.entries(content.generated_content).map(([platform, text]) => {
                      const [basePlatform, type] = platform.split('_')
                      const Icon = {
                        facebook: FacebookIcon,
                        twitter: TwitterIcon,
                        instagram: InstagramIcon,
                        linkedin: LinkedinIcon
                      }[basePlatform]

                      const iconColors = {
                        facebook: 'text-blue-600',
                        twitter: 'text-blue-400',
                        instagram: 'text-pink-600',
                        linkedin: 'text-blue-700'
                      }[basePlatform]

                      return (
                        <div key={platform} className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-5 h-5 ${iconColors}`} />
                            <h4 className="text-sm font-medium text-gray-900">
                              <span className="capitalize">{basePlatform}</span>
                              <span className="text-gray-500 ml-1">
                                ({type === 'organic' ? 'Organic Post' : 'Ad Copy'})
                              </span>
                            </h4>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{text as string}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500">No content generated yet. Configure your options and click Generate Content to get started.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Select Images</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {listingImages.map((image) => {
                    const signedUrlData = signedUrls[image.id]
                    
                    if (!signedUrlData || signedUrlData.isLoading) {
                      return (
                        <div key={image.id} className="relative aspect-[4/3] bg-gray-100 animate-pulse rounded-lg">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                          </div>
                        </div>
                      )
                    }

                    if (!signedUrlData.signedUrl) return null

                    return (
                      <div key={image.id} className="relative group">
                        <div 
                          className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 ${
                            selectedImages.includes(image.id) 
                              ? 'border-blue-500' 
                              : 'border-transparent'
                          }`}
                        >
                          <img
                            src={signedUrlData.signedUrl}
                            alt={image.caption || ''}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${signedUrlData.isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => {
                              setSignedUrls(prev => ({
                                ...prev,
                                [image.id]: { ...prev[image.id], isImageLoaded: true }
                              }))
                            }}
                          />
                          {!signedUrlData.isImageLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse rounded-lg">
                              <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                          )}
                          <div 
                            className={`absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 transition-opacity ${
                              selectedImages.includes(image.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <button
                              onClick={() => handleImageSelection(image.id)}
                              className="p-2 bg-white rounded-full"
                            >
                              <CheckCircleIcon 
                                className={`w-6 h-6 ${
                                  selectedImages.includes(image.id) 
                                    ? 'text-blue-500' 
                                    : 'text-gray-400'
                                }`} 
                              />
                            </button>
                          </div>
                        </div>
                        {selectedImages.includes(image.id) && (
                          <div className="mt-2">
                            <RadioGroup value={heroImage} onChange={handleHeroImageChange}>
                              <RadioGroup.Option value={image.id}>
                                {({ checked }) => (
                                  <div className={`flex items-center space-x-2 cursor-pointer ${checked ? 'text-blue-500' : 'text-gray-500'}`}>
                                    <div className={`w-4 h-4 rounded-full border ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                      {checked && <div className="w-2 h-2 mx-auto mt-0.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="text-sm">Set as hero image</span>
                                  </div>
                                )}
                              </RadioGroup.Option>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    {selectedImages.length === 0 
                      ? "Select at least one image for your social media posts." 
                      : `Selected ${selectedImages.length} image${selectedImages.length === 1 ? '' : 's'}${heroImage ? ', with hero image set' : ''}.`
                    }
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                {Object.entries(content.generated_content || {}).map(([platform, text]) => {
                  const [basePlatform, type] = platform.split('_')
                  const Icon = {
                    facebook: FacebookIcon,
                    twitter: TwitterIcon,
                    instagram: InstagramIcon,
                    linkedin: LinkedinIcon
                  }[basePlatform as Platform]

                  const iconColors = {
                    facebook: 'text-blue-600',
                    twitter: 'text-blue-400',
                    instagram: 'text-pink-600',
                    linkedin: 'text-blue-700'
                  }[basePlatform as Platform]

                  return (
                    <div key={platform} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${iconColors}`} />
                        <h3 className="text-lg font-medium">
                          <span className="capitalize">{basePlatform}</span>
                          <span className="text-gray-500 ml-1">
                            ({type === 'organic' ? 'Organic Post' : 'Ad Copy'})
                          </span>
                        </h3>
                      </div>
                      
                      {/* Preview all selected images */}
                      <div className="mb-4 space-y-4">
                        {selectedImages.map((imageId, index) => {
                          const signedUrlData = signedUrls[imageId]
                          if (!signedUrlData?.signedUrl) return null

                          return (
                            <div key={imageId} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                  {imageId === heroImage ? 'Hero Image' : `Additional Image ${index + 1}`}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {PLATFORM_IMAGE_SIZES[basePlatform as Platform].width}x
                                  {PLATFORM_IMAGE_SIZES[basePlatform as Platform].height}
                                </span>
                              </div>
                              <div 
                                className="relative aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden"
                                style={{
                                  aspectRatio: `${PLATFORM_IMAGE_SIZES[basePlatform as Platform].width}/${PLATFORM_IMAGE_SIZES[basePlatform as Platform].height}`
                                }}
                              >
                                {/* Loading state */}
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                                
                                {/* Image with proper sizing */}
                                <img
                                  src={signedUrlData.signedUrl}
                                  alt={`Preview ${index + 1}`}
                                  className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                  onLoad={async (e) => {
                                    try {
                                      const resizedUrl = await resizeImageForPlatform(
                                        signedUrlData.signedUrl!,
                                        basePlatform as Platform
                                      )
                                      const target = e.target as HTMLImageElement
                                      target.src = resizedUrl
                                      target.classList.remove('opacity-0')
                                    } catch (error) {
                                      console.error('Error resizing image:', error)
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Editable content */}
                      <textarea
                        value={editedContent[platform] ?? text}
                        onChange={(e) => {
                          setEditedContent(prev => ({
                            ...prev,
                            [platform]: e.target.value
                          }))
                          debouncedSaveContent(platform, e.target.value)
                        }}
                        rows={6}
                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="post" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Add posting options and scheduling */}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
} 