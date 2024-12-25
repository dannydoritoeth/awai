"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'

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
  }, [listingId])

  async function loadListing() {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          generated_descriptions (
            id,
            content,
            created_at
          )
        `)
        .eq('id', listingId)
        .single()

      if (error) throw error
      setListing(data)
    } catch (err) {
      console.error('Error loading listing:', err)
      setError('Failed to load listing')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error || !listing) {
    return <div>Error: {error || 'Listing not found'}</div>
  }

  const descriptions = listing.generated_descriptions || []
  const currentDescription = descriptions[currentDescriptionIndex]

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentDescription.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Listing Details */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {listing.address}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Property Type</p>
            <p className="text-gray-900">{listing.property_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Listing Type</p>
            <p className="text-gray-900">{listing.listing_type}</p>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Generated Description
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={copyToClipboard}
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