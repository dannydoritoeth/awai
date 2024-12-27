import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface DescriptionViewerProps {
  listing: any
  descriptions: Array<{
    id: string
    content: string
    created_at: string
    status: string
  }>
  currentIndex: number
  onIndexChange: (index: number) => void
  onComplete: () => void
}

const PORTALS = [
  { id: 'rea', name: 'Realestate.com.au', icon: '🏠' },
  { id: 'domain', name: 'Domain', icon: '🏘️' },
  { id: 'rma', name: 'RateMyAgent', icon: '⭐' },
  { id: 'homely', name: 'Homely', icon: '🏡' },
  { id: 'properti', name: 'Properti', icon: '🔑' }
]

export function DescriptionViewer({ 
  listing, 
  descriptions, 
  currentIndex,
  onIndexChange,
  onComplete 
}: DescriptionViewerProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [selectedPortals, setSelectedPortals] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Debug logs
  console.log('DescriptionViewer props:', {
    descriptionsCount: descriptions.length,
    currentIndex,
    currentContent: descriptions[currentIndex]?.content
  })

  useEffect(() => {
    if (descriptions[currentIndex]?.content) {
      setContent(descriptions[currentIndex].content)
      console.log('Setting content:', descriptions[currentIndex].content)
    }
  }, [descriptions, currentIndex])

  // Sort descriptions by created_at in ascending order
  const sortedDescriptions = [...descriptions].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // When a new description is added, automatically show it
  useEffect(() => {
    if (descriptions.length > 0) {
      // Set index to the latest description (last in the sorted array)
      onIndexChange(descriptions.length - 1)
    }
  }, [descriptions.length])

  const currentDescription = sortedDescriptions[currentIndex]
  const isApproved = currentDescription?.status === 'approved'
  const isProcessing = currentDescription?.status === 'processing'
  const isGenerating = currentDescription?.status === 'generating'
  const hasError = currentDescription?.status === 'error'

  if (!currentDescription) {
    console.log('No current description found')
    return null
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('generated_descriptions')
        .update({ content })
        .eq('id', currentDescription.id)

      if (error) throw error
      setEditing(false)
    } catch (err) {
      console.error('Error saving description:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from('generated_descriptions')
        .update({ status: 'approved' })
        .eq('id', currentDescription.id)

      if (error) throw error
    } catch (err) {
      console.error('Error approving description:', err)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      // TODO: Implement portal sync logic
      console.log('Syncing to portals:', selectedPortals)
    } catch (err) {
      console.error('Error syncing to portals:', err)
    } finally {
      setSyncing(false)
    }
  }

  const currentVersion = currentIndex + 1
  const totalVersions = sortedDescriptions.length

  // Add polling for generating status
  useEffect(() => {
    if (!currentDescription || currentDescription.status !== 'generating') return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('generated_descriptions')
        .select('*')
        .eq('id', currentDescription.id)
        .single()

      if (data && data.status !== 'generating') {
        // Refresh the full list when status changes
        onComplete()
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentDescription?.id, currentDescription?.status, onComplete])

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Description</h3>
          <p className="text-sm text-gray-500">
            Created: {new Date(currentDescription.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* ... copy button ... */}
          <div className="text-sm text-gray-500">
            Version {currentVersion} of {totalVersions}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onIndexChange(Math.min(sortedDescriptions.length - 1, currentIndex + 1))}
              disabled={currentIndex === sortedDescriptions.length - 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Show generating status */}
      {isGenerating ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="text-gray-500 mt-4">Generating Description...</div>
        </div>
      ) : (
        <div className="text-gray-700 whitespace-pre-wrap">
          {currentDescription?.content || 'No description available'}
        </div>
      )}

      {/* ... rest of the component ... */}
    </div>
  )
} 