"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ListingDetailProps {
  listing: any // Type this properly based on your data structure
}

export function ListingDetail({ listing }: ListingDetailProps) {
  const [description, setDescription] = useState(listing.description)
  const [generating, setGenerating] = useState(false)

  async function regenerateDescription() {
    setGenerating(true)
    try {
      // Call your OpenAI endpoint
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listing)
      })
      
      const { description: newDescription } = await response.json()
      
      // Update in Supabase
      await supabase
        .from('listings')
        .update({ description: newDescription })
        .eq('id', listing.id)

      setDescription(newDescription)
    } catch (error) {
      console.error('Error regenerating description:', error)
    } finally {
      setGenerating(false)
    }
  }

  async function handleUpdate(updates: Partial<Listing>) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('listings')
        .update({ ...updates, user_id: user.id })
        .eq('id', listing.id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating listing:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-medium text-gray-900">{listing.address}</h2>
        <div className="mt-2 text-gray-500">
          {listing.property_type} · {listing.listing_type}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Property Description</h3>
          <button
            onClick={regenerateDescription}
            disabled={generating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
        <div className="prose max-w-none">
          {description || 'No description generated yet.'}
        </div>
      </div>
    </div>
  )
} 