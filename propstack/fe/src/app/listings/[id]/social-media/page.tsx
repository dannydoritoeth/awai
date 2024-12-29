"use client"

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/layout/PageHeading'

interface Content {
  id: string
  title: string
  content: string
  platform: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  created_at: string
}

interface SocialMediaPageProps {
  params: Promise<{
    id: string
  }>
}

export default function SocialMediaPage({ params }: SocialMediaPageProps) {
  const { id } = use(params)
  const [listing, setListing] = useState<any>(null)
  const [content, setContent] = useState<Content[]>([])
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const [listingRes, contentRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('social_media_content')
          .select('*')
          .eq('listing_id', id)
          .order('created_at', { ascending: false })
      ])
      
      if (listingRes.data) setListing(listingRes.data)
      if (contentRes.data) setContent(contentRes.data)
    }

    fetchData()
  }, [id])

  const handleNewContent = () => {
    router.push(`/listings/${id}/social-media/new`)
  }

  if (!listing) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Social Media Content"
          backHref={`/listings/${id}`}
          showBackButton
        />
        <p className="text-gray-600 -mt-6 mb-8 ml-11">{listing.address}</p>

        <div className="mt-8">
          <Button
            onClick={handleNewContent}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Content
          </Button>

          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled For</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {content.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/listings/${id}/social-media/${item.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.platform}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'published' ? 'bg-green-100 text-green-800' :
                        item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.scheduled_for ? new Date(item.scheduled_for).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {content.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No content created yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
} 