"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'

interface SocialMediaContent {
  id: string
  listing_id: string
  platform: string
  content_type: string
  status: string
  created_at: string
  title: string
}

interface SocialMediaTableProps {
  listingId: string
}

export function SocialMediaTable({ listingId }: SocialMediaTableProps) {
  const router = useRouter()
  const [content, setContent] = useState<SocialMediaContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadContent()
  }, [listingId])

  async function loadContent() {
    try {
      const { data, error } = await supabase
        .from('social_media_content')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContent(data || [])
    } catch (err) {
      console.error('Error loading social media content:', err)
      setError('Failed to load social media content')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  if (error) {
    return <div className="text-red-600 py-4">{error}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Platform
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {content.map(item => (
            <tr 
              key={item.id}
              onClick={() => router.push(`/listings/${listingId}/social-media/${item.id}`)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {item.title}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {item.platform}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {item.content_type}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                  ${item.status === 'published' ? 'bg-green-100 text-green-800' : 
                    item.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'}`}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
          {content.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                No social media content found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
} 