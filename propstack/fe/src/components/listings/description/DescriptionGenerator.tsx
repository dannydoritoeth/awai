import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
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
  locale: 'us' | 'au' | 'uk' | 'ca' | 'nz'
  naturalness: {
    useColloquialisms: boolean
    includeLocalReferences: boolean
    varyPhrasing: boolean
    avoidBuzzwords: boolean
    useSpecificDetails: boolean
    strictFactChecking: boolean
  }
  emphasis: {
    uniqueFeatures: boolean
    emotionalAppeal: boolean
    practicalBenefits: boolean
  }
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
  targetAudience: ['buyers'],
  locale: 'au',
  naturalness: {
    useColloquialisms: true,
    includeLocalReferences: true,
    varyPhrasing: true,
    avoidBuzzwords: true,
    useSpecificDetails: true,
    strictFactChecking: true
  },
  emphasis: {
    uniqueFeatures: true,
    emotionalAppeal: true,
    practicalBenefits: true
  }
}

const detectRegionFromAddress = (address: string): 'us' | 'au' | 'uk' | 'ca' | 'nz' => {
  const lowerAddress = address.toLowerCase()
  
  // Australian states/territories
  if (
    lowerAddress.includes('nsw') || 
    lowerAddress.includes('vic') || 
    lowerAddress.includes('qld') || 
    lowerAddress.includes('wa') || 
    lowerAddress.includes('sa') || 
    lowerAddress.includes('tas') || 
    lowerAddress.includes('act') || 
    lowerAddress.includes('nt') ||
    lowerAddress.includes('australia')
  ) {
    return 'au'
  }
  
  // US states/zip codes
  if (
    /\b\d{5}(-\d{4})?\b/.test(lowerAddress) || // US ZIP code
    lowerAddress.includes('united states') ||
    lowerAddress.includes('usa')
  ) {
    return 'us'
  }
  
  // UK postcodes
  if (
    /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(lowerAddress) ||
    lowerAddress.includes('united kingdom') ||
    lowerAddress.includes('england') ||
    lowerAddress.includes('scotland') ||
    lowerAddress.includes('wales')
  ) {
    return 'uk'
  }
  
  // Canadian postal codes
  if (
    /[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d/i.test(lowerAddress) ||
    lowerAddress.includes('canada')
  ) {
    return 'ca'
  }
  
  // New Zealand postcodes and identifiers
  if (
    /\b\d{4}\b/.test(lowerAddress) && (
      lowerAddress.includes('new zealand') ||
      lowerAddress.includes('nz')
    )
  ) {
    return 'nz'
  }
  
  return 'au' // Default to Australian if no match found
}

export function DescriptionGenerator({ listing, onComplete }: DescriptionGeneratorProps) {
  const [options, setOptions] = useState<GenerationOptions>({
    ...defaultOptions,
    locale: detectRegionFromAddress(listing.address)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNaturalness, setShowNaturalness] = useState(false)
  const [showEmphasis, setShowEmphasis] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
      // Validate listing ID
      if (!listing?.id) {
        throw new Error('Invalid listing ID')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create the payload
      const payload = {
        listingId: listing.id,
        options: {
          ...options,
          naturalness: {
            ...options.naturalness,
            strictFactChecking: options.naturalness.strictFactChecking !== false
          }
        },
        listingData: {
          id: listing.id,
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
          otherDetails: listing.other_details,
          verifiedAmenities: listing.verified_amenities,
          verifiedFeatures: listing.verified_features,
          verifiedMeasurements: {
            lotSize: listing.lot_size,
            interiorSize: listing.interior_size,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            parking: listing.parking
          }
        }
      }

      console.log('Sending payload:', payload)

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        'generate-description',
        {
          body: payload  // Remove JSON.stringify, let Supabase handle it
        }
      )

      if (fnError) {
        console.error('Edge function error:', fnError)
        throw new Error(fnError instanceof Error ? fnError.message : 'Failed to generate description')
      }

      console.log('Edge function response:', data)

      if (!data) {
        throw new Error('No response from description generator')
      }

      onComplete()
    } catch (err) {
      console.error('Error generating description:', err)
      let errorMessage = 'Failed to generate description'
      
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = JSON.stringify(err)
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const CollapsibleSection = ({ 
    title, 
    description, 
    isOpen, 
    onToggle, 
    children 
  }: { 
    title: string
    description?: string
    isOpen: boolean
    onToggle: () => void
    children: React.ReactNode 
  }) => (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        <ChevronDownIcon 
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t">
          {children}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        {/* Basic Options */}
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
              </div>
            )}
          </div>

          {/* Style and Format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language & Region
            </label>
            <select
              value={options.locale}
              onChange={(e) => setOptions(prev => ({ ...prev, locale: e.target.value as any }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="au">Australian English {options.locale === 'au' && '(Auto-detected)'}</option>
              <option value="us">American English {options.locale === 'us' && '(Auto-detected)'}</option>
              <option value="uk">British English {options.locale === 'uk' && '(Auto-detected)'}</option>
              <option value="ca">Canadian English {options.locale === 'ca' && '(Auto-detected)'}</option>
              <option value="nz">New Zealand English {options.locale === 'nz' && '(Auto-detected)'}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Region auto-detected from address. You can change this if needed.
            </p>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="space-y-4">
          <CollapsibleSection
            title="Advanced Options"
            description="Fine-tune your description with advanced settings"
            isOpen={showAdvanced}
            onToggle={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="space-y-6 pt-4">
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
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Natural Language Settings"
            description="Make the description sound more natural and authentic"
            isOpen={showNaturalness}
            onToggle={() => setShowNaturalness(!showNaturalness)}
          >
            <div className="space-y-3 pt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.naturalness.useColloquialisms}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    naturalness: {
                      ...prev.naturalness,
                      useColloquialisms: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Use Natural Language</span>
                  <p className="text-xs text-gray-500">Include conversational phrases and local expressions</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.naturalness.includeLocalReferences}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    naturalness: {
                      ...prev.naturalness,
                      includeLocalReferences: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Include Local Context</span>
                  <p className="text-xs text-gray-500">Reference nearby landmarks and community features</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.naturalness.avoidBuzzwords}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    naturalness: {
                      ...prev.naturalness,
                      avoidBuzzwords: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Avoid Common Buzzwords</span>
                  <p className="text-xs text-gray-500">Skip overused real estate phrases and clichés</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.naturalness.useSpecificDetails}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    naturalness: {
                      ...prev.naturalness,
                      useSpecificDetails: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Include Specific Details</span>
                  <p className="text-xs text-gray-500">Mention unique features and exact measurements</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.naturalness.strictFactChecking}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    naturalness: {
                      ...prev.naturalness,
                      strictFactChecking: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Strict Fact Checking</span>
                  <p className="text-xs text-gray-500">Only include verified information from the listing data</p>
                </span>
              </label>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Content Emphasis"
            description="Choose what aspects to emphasize in the description"
            isOpen={showEmphasis}
            onToggle={() => setShowEmphasis(!showEmphasis)}
          >
            <div className="space-y-3 pt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.emphasis.uniqueFeatures}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    emphasis: {
                      ...prev.emphasis,
                      uniqueFeatures: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Highlight Unique Features</span>
                  <p className="text-xs text-gray-500">Emphasize what makes this property special</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.emphasis.emotionalAppeal}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    emphasis: {
                      ...prev.emphasis,
                      emotionalAppeal: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Emotional Connection</span>
                  <p className="text-xs text-gray-500">Focus on lifestyle and emotional benefits</p>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.emphasis.practicalBenefits}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    emphasis: {
                      ...prev.emphasis,
                      practicalBenefits: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="text-sm font-medium text-gray-700">Practical Benefits</span>
                  <p className="text-xs text-gray-500">Highlight practical advantages and value</p>
                </span>
              </label>
            </div>
          </CollapsibleSection>
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