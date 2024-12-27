import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface DescriptionGeneratorProps {
  listing: any
  onComplete: () => void
}

interface GenerationOptions {
  length: 'short' | 'medium' | 'long' | 'custom'
  style: 'professional' | 'casual' | 'luxury' | 'modern'
  format: 'paragraph' | 'bullet-points' | 'structured'
  tone: 'formal' | 'friendly' | 'enthusiastic'
  focus: string[]
  wordCount?: number
  includeCallToAction: boolean
  targetAudience: string[]
  customInstructions?: string
}

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', wordCount: '100-150 words' },
  { value: 'medium', label: 'Medium', wordCount: '200-300 words' },
  { value: 'long', label: 'Long', wordCount: '400-600 words' },
  { value: 'custom', label: 'Custom', wordCount: 'Set your own' }
] as const

const defaultOptions: GenerationOptions = {
  length: 'medium',
  style: 'professional',
  format: 'paragraph',
  tone: 'formal',
  focus: [],
  includeCallToAction: true,
  targetAudience: ['buyers']
}

export function DescriptionGenerator({ listing, onComplete }: DescriptionGeneratorProps) {
  const [options, setOptions] = useState<GenerationOptions>(defaultOptions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const focusOptions = [
    { value: 'location', label: 'Location & Neighborhood' },
    { value: 'features', label: 'Property Features' },
    { value: 'lifestyle', label: 'Lifestyle Benefits' },
    { value: 'investment', label: 'Investment Potential' },
    { value: 'renovation', label: 'Renovation Potential' },
    { value: 'views', label: 'Views & Scenery' },
    { value: 'outdoor', label: 'Outdoor Living' }
  ]

  const audienceOptions = [
    { value: 'buyers', label: 'Home Buyers' },
    { value: 'investors', label: 'Investors' },
    { value: 'luxury', label: 'Luxury Buyers' },
    { value: 'first-time', label: 'First-Time Buyers' },
    { value: 'downsizers', label: 'Downsizers' },
    { value: 'families', label: 'Families' }
  ]

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validate custom word count
      if (options.length === 'custom' && (!options.wordCount || options.wordCount < 50 || options.wordCount > 1000)) {
        throw new Error('Please enter a valid word count between 50 and 1000 words')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update listing status
      await supabase
        .from('listings')
        .update({ description_status: 'pending' })
        .eq('id', listing.id)

      // Create description generation request
      const { error: insertError } = await supabase
        .from('generated_descriptions')
        .insert([{
          listing_id: listing.id,
          options: options,
          status: 'processing'
        }])

      if (insertError) throw insertError

      // Call edge function to start generation
      const { error: fnError } = await supabase.functions.invoke('generate-description', {
        body: {
          listingId: listing.id,
          options: options,
          listingData: {
            propertyType: listing.property_type,
            listingType: listing.listing_type,
            price: listing.price,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            parking: listing.parking,
            lotSize: listing.lot_size,
            interiorSize: listing.interior_size,
            propertyHighlights: listing.property_highlights,
            locationHighlights: listing.location_highlights,
            locationNotes: listing.location_notes,
            otherDetails: listing.other_details
          }
        }
      })

      if (fnError) throw fnError

      onComplete()
    } catch (err) {
      console.error('Error generating description:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        {/* Length Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description Length
          </label>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setOptions(prev => ({ 
                  ...prev, 
                  length: option.value,
                  // Clear wordCount when switching to preset lengths
                  wordCount: option.value === 'custom' ? prev.wordCount : undefined
                }))}
                className={`px-4 py-2 rounded-md text-sm
                  ${options.length === option.value
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                  } border`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500 mt-1">{option.wordCount}</div>
              </button>
            ))}
          </div>
          {options.length === 'custom' && (
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">
                Custom Word Count
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  placeholder="Enter word count"
                  value={options.wordCount || ''}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    wordCount: parseInt(e.target.value) 
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  words
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter a value between 50 and 1000 words
              </p>
            </div>
          )}
        </div>

        {/* Style Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Writing Style
          </label>
          <select
            value={options.style}
            onChange={(e) => setOptions(prev => ({ ...prev, style: e.target.value as any }))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="luxury">Luxury</option>
            <option value="modern">Modern</option>
          </select>
        </div>

        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Format
          </label>
          <select
            value={options.format}
            onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as any }))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="paragraph">Paragraphs</option>
            <option value="bullet-points">Bullet Points</option>
            <option value="structured">Structured (Features & Benefits)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {options.format === 'paragraph' && 
              'Traditional flowing paragraphs ideal for property listings'}
            {options.format === 'bullet-points' && 
              'Easy-to-scan bullet points highlighting key features'}
            {options.format === 'structured' && 
              'Organized sections with clear headings for features, benefits, and details'}
          </p>
        </div>

        {/* Focus Areas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Key Focus Areas
          </label>
          <div className="space-y-2">
            {focusOptions.map((focus) => (
              <label key={focus.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.focus.includes(focus.value)}
                  onChange={(e) => {
                    const newFocus = e.target.checked
                      ? [...options.focus, focus.value]
                      : options.focus.filter(f => f !== focus.value)
                    setOptions(prev => ({ ...prev, focus: newFocus }))
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{focus.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience
          </label>
          <div className="space-y-2">
            {audienceOptions.map((audience) => (
              <label key={audience.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.targetAudience.includes(audience.value)}
                  onChange={(e) => {
                    const newAudience = e.target.checked
                      ? [...options.targetAudience, audience.value]
                      : options.targetAudience.filter(a => a !== audience.value)
                    setOptions(prev => ({ ...prev, targetAudience: newAudience }))
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{audience.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Instructions (Optional)
          </label>
          <textarea
            value={options.customInstructions || ''}
            onChange={(e) => setOptions(prev => ({ 
              ...prev, 
              customInstructions: e.target.value 
            }))}
            rows={3}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Add any specific instructions or preferences..."
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`w-full px-4 py-2 rounded-md text-white font-medium
            ${loading 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {loading ? 'Generating...' : 'Generate Description'}
        </button>
      </div>
    </div>
  )
} 