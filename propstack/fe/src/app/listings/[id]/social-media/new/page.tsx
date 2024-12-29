"use client"

import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { PageHeading } from "@/components/layout/PageHeading"

interface NewContentPageProps {
  params: Promise<{
    id: string
  }>
}

const POST_TYPES = [
  { value: "new_listing", label: "New Listing Announcement" },
  { value: "price_update", label: "Price Update" },
  { value: "open_house", label: "Open House" },
  { value: "just_sold", label: "Just Sold" },
  { value: "custom", label: "Custom" }
]

export default function NewContentPage({ params }: NewContentPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [postType, setPostType] = useState("")
  const [customContext, setCustomContext] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, userRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*")
          .eq("id", id)
          .single(),
        supabase.auth.getUser()
      ])

      if (listingRes.error) {
        console.error("Error fetching listing:", listingRes.error)
        return
      }

      setListing(listingRes.data)
      setUser(userRes.data.user)
      setLoading(false)
    }

    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !postType || (postType === "custom" && !customContext)) return
    if (!user) {
      alert("Please sign in to create content")
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from("social_media_content")
        .insert({
          listing_id: id,
          user_id: user.id,
          title,
          post_type: postType,
          custom_context: postType === "custom" ? customContext : null,
          status: "draft"
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/listings/${id}/social-media/${data.id}`)
    } catch (error) {
      console.error("Error creating content:", error)
      alert("Failed to create content. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="p-8">
        <p>Listing not found</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-8">
        <p>Please sign in to create content</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeading 
        title="New Social Media Content"
        backHref={`/listings/${id}/social-media`}
        showBackButton
      >
        {listing.address}
      </PageHeading>

      <div className="mt-6 max-w-xl">
        <form onSubmit={handleSubmit} className="bg-white shadow sm:rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., January Open House Announcement"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Give your post a memorable name for easy reference
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Type
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            >
              <option value="">Select a template to help generate your content</option>
              {POST_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {postType === "custom" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Post Context
              </label>
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Provide context for your custom post..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Describe what you want to highlight or announce in this post
              </p>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isCreating || !title || !postType || (postType === "custom" && !customContext)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
            >
              {isCreating ? "Creating..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 