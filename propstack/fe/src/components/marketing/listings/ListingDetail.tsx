"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { ListingSummary } from './ListingSummary'

interface ListingDetailProps {
  listingId: string
}

export function ListingDetail({ listingId }: ListingDetailProps) {
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDescriptionIndex, setCurrentDescriptionIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadListing()

    // Set up polling if description is processing/generating
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('generated_descriptions')
        .select('status')
        .eq('listing_id', listingId)
        .single()

      if (data?.status === 'completed' || data?.status === 'error') {
        clearInterval(interval)
        loadListing() // Reload to get final description
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [listingId])

  async function loadListing() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }

      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          generated_descriptions (
            content,
            language,
            version,
            created_at
          )
        `)
        .eq('id', listingId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      if (!data) throw new Error('Listing not found')

      setListing(data)
    } catch (err) {
      console.error('Error loading listing:', err)
      setError(err instanceof Error ? err.message : 'Failed to load listing')
    } finally {
      setLoading(false)
    }
  }

  const descriptions = listing?.generated_descriptions || []
  const currentDescription = descriptions[currentDescriptionIndex]

  const handleCopy = async () => {
    if (currentDescription?.content) {
      await navigator.clipboard.writeText(currentDescription.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Add date formatting helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <div className="animate-pulse bg-white rounded-lg h-32"></div>
  }

  if (error || !listing) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Unable to load listing
        </h2>
        <p className="text-gray-600">
          {error || 'The listing could not be found'}
        </p>
      </div>
    )
  }

  // Show loading state while generating
  if (currentDescription?.status === 'processing' || currentDescription?.status === 'generating') {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <div className="flex items-center justify-between">
          <Link
            href="/marketing/descriptions"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-1" />
            Back to Listings
          </Link>
        </div>

        {/* Property Details */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-medium text-gray-900">{listing.address}</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Property Details</h3>
              <dl className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-900">{listing.property_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">For</dt>
                  <dd className="text-gray-900">{listing.listing_type}</dd>
                </div>
                {listing.price && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Price</dt>
                    <dd className="text-gray-900">{listing.price}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Features</h3>
              <dl className="mt-2 space-y-2">
                {listing.bedrooms && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Bedrooms</dt>
                    <dd className="text-gray-900">{listing.bedrooms}</dd>
                  </div>
                )}
                {listing.bathrooms && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Bathrooms</dt>
                    <dd className="text-gray-900">{listing.bathrooms}</dd>
                  </div>
                )}
                {listing.parking && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Parking</dt>
                    <dd className="text-gray-900">{listing.parking}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Loading Description Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Property Description</h3>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="text-gray-500 mt-4">Generating description...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/marketing/descriptions"
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-1" />
          Back to Listings
        </Link>
      </div>

      {/* Property Info Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {listing.address}
            {listing.unit_number && ` Unit ${listing.unit_number}`}
          </h2>
          <div className="text-sm text-gray-500">
            Created {formatDate(listing.created_at)}
          </div>
        </div>
        <ListingSummary listing={listing} />
      </div>

      {/* Generated Descriptions Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Property Description</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-5 h-5 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="w-5 h-5" />
              )}
              <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <div className="text-sm text-gray-500">
              Version {currentDescriptionIndex + 1} of {descriptions.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentDescriptionIndex(i => Math.max(0, i - 1))}
                disabled={currentDescriptionIndex === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentDescriptionIndex(i => Math.min(descriptions.length - 1, i + 1))}
                disabled={currentDescriptionIndex === descriptions.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="text-gray-700 whitespace-pre-wrap">
          {currentDescription?.content || 'No description generated yet.'}
        </div>
      </div>
    </div>
  )
} 