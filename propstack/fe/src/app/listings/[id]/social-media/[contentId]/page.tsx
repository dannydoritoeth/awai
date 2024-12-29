"use client"

import { PageHeading } from "@/components/layout/PageHeading"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FacebookIcon, TwitterIcon, InstagramIcon, LinkedinIcon } from "@/components/icons/social"
import { supabase } from "@/lib/supabase"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"

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
  platforms: Platform[]
  generateAdCopy: boolean
  selectedPlatforms: {
    [key in Platform]: PlatformOptions
  }
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
    platforms: ["facebook", "instagram", "twitter", "linkedin"],
    generateAdCopy: false,
    selectedPlatforms: {
      facebook: { organic: true, ad: false },
      instagram: { organic: true, ad: false },
      twitter: { organic: true, ad: false },
      linkedin: { organic: true, ad: false }
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [listingRes, contentRes] = await Promise.all([
          supabase
            .from("listings")
            .select("*")
            .eq("id", id)
            .single(),
          supabase
            .from("social_media_content")
            .select("*")
            .eq("id", contentId)
            .single()
        ])

        if (listingRes.error) {
          console.error("Error fetching listing:", listingRes.error)
          return
        }
        if (contentRes.error) {
          console.error("Error fetching content:", contentRes.error)
          return
        }

        setListing(listingRes.data)
        setContent(contentRes.data)
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [id, contentId])

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
                    {Object.entries(content.generated_content).map(([platform, text]) => (
                      <div key={platform} className="p-4 border rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 capitalize mb-2">{platform}</h4>
                        <p className="text-gray-700 whitespace-pre-wrap">{text as string}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No content generated yet. Configure your options and click Generate Content to get started.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Add image selection grid */}
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FacebookIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-medium">Facebook</h3>
                  </div>
                  {/* Add Facebook content editor */}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TwitterIcon className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium">Twitter</h3>
                  </div>
                  {/* Add Twitter content editor */}
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <InstagramIcon className="w-5 h-5 text-pink-600" />
                    <h3 className="text-lg font-medium">Instagram</h3>
                  </div>
                  {/* Add Instagram content editor */}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <LinkedinIcon className="w-5 h-5 text-blue-700" />
                    <h3 className="text-lg font-medium">LinkedIn</h3>
                  </div>
                  {/* Add LinkedIn content editor */}
                </div>
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