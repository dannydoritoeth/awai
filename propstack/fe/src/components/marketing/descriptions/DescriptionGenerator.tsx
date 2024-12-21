"use client"

import { useState, useEffect } from 'react'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ListingFormData } from '@/types'
import { GenerateAuthModal } from '@/components/marketing/descriptions/GenerateAuthModal'
import { ListingSummary } from '@/components/marketing/listings/ListingSummary'

interface DescriptionGeneratorProps {
  onBack: () => void
  formData: ListingFormData
}

export function DescriptionGenerator({ onBack, formData }: DescriptionGeneratorProps) {
  const [language, setLanguage] = useState('English (Australia)')
  const [length, setLength] = useState('300')
  const [unit, setUnit] = useState('Words')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()

  // Store form data when showing auth modal
  useEffect(() => {
    if (showAuthModal) {
      localStorage.setItem('pendingListingData', JSON.stringify({
        formData,
        language,
        length,
        unit
      }))
    }
  }, [showAuthModal, formData, language, length, unit])

  const formatHighlights = (highlights: string[]) => {
    if (highlights.length === 0) return 'None selected'
    return highlights.join(', ')
  }

  const formatPrice = (price: string, currency: string) => {
    return `${currency}${price.toString().replace('k', ',000')}`
  }

  const formatSize = (size: string, unit: string) => {
    return `${size} ${unit}`
  }

  // Check auth before generation
  async function handleGenerateDescription() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Just show auth modal - don't save anything yet
      setShowAuthModal(true)
      return
    }

    // Check credits
    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', session.user.id)
      .single()

    if (creditsError) {
      setError('Failed to check credits. Please try again.')
      return
    }

    if (credits.balance < 1) {
      setError('Not enough credits. Please upgrade your plan.')
      return
    }

    // Only proceed with generation if logged in
    setSaving(true)
    setError(null)
    
    try {
      // Destructure out all camelCase fields
      const { 
        fullAddress, 
        interiorSize,
        interiorSizeUnit,
        lotSize,
        lotSizeUnit,
        currency,
        listingType,
        propertyType,
        unitNumber,
        otherDetails,
        ...rest 
      } = formData;
      
      const formattedData = {
        ...rest,
        user_id: session.user.id,
        // Convert all fields to snake_case
        listing_type: listingType,
        property_type: propertyType,
        unit_number: unitNumber,
        other_details: otherDetails,
        // Format price with currency symbol
        price: formData.price ? `${formData.currency}${formData.price}` : null,
        // Format sizes with units
        lot_size: formData.lotSize ? `${formData.lotSize} ${formData.lotSizeUnit}` : null,
        interior_size: formData.interiorSize ? `${formData.interiorSize} ${formData.interiorSizeUnit}` : null,
      }

      // Create listing with formatted values
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert(formattedData)
        .select()
        .single()

      if (listingError) throw listingError

      // Create description with processing status
      const { data: description, error: descError } = await supabase
        .from('generated_descriptions')
        .insert({
          listing_id: listing.id,
          content: 'Generating...',
          status: 'processing',
          language: language,
          target_length: parseInt(length),
          target_unit: unit.toLowerCase(),
          version: 1,
          is_selected: true
        })
        .select()
        .single()

      if (descError) throw descError

      // Pass the same formatted data to the Edge Function
      supabase.functions.invoke('generate-description', {
        body: {
          id: listing.id,
          ...formattedData,
          language,
          target_length: parseInt(length),
          target_unit: unit
        }
      })

      // Deduct credit after successful generation
      const { error: deductError } = await supabase
        .from('credits')
        .update({ balance: credits.balance - 1 })
        .eq('user_id', session.user.id)

      if (deductError) throw deductError

      // Redirect immediately to listing page
      router.push(`/marketing/listings/${listing.id}`)

    } catch (error) {
      console.error('Error:', error)
      setError('Failed to generate description. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-900 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4">
        {/* Language and Length Settings */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Language</h3>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-2 w-full rounded-md border-gray-300 text-gray-900"
          >
            <option>English (Australia)</option>
            <option>English (New Zealand)</option>
            <option>English (UK)</option>
            <option>English (US)</option>
            <option>English (Canada)</option>
            <option>French (Canada)</option>
          </select>

          <div className="mt-6 flex gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">Ideal Length</h3>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full rounded-md border-gray-300 text-gray-900"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-32 rounded-md border-gray-300 text-gray-900"
                >
                  <option>Words</option>
                  <option>Characters</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Listing Summary</h3>
          {console.log('Form Data for Summary:', {
            lotSize: formData.lotSize,
            lotSizeUnit: formData.lotSizeUnit,
            interiorSize: formData.interiorSize,
            interiorSizeUnit: formData.interiorSizeUnit,
            otherDetails: formData.otherDetails
          })}
          
          <ListingSummary 
            listing={{
              address: formData.address,
              unitNumber: formData.unitNumber,
              propertyType: formData.propertyType,
              listingType: formData.listingType,
              price: formData.price ? `${formData.currency}${formData.price}` : undefined,
              bedrooms: formData.bedrooms,
              bathrooms: formData.bathrooms,
              parking: formData.parking,
              lotSize: formData.lotSize && formData.lotSizeUnit 
                ? `${formData.lotSize} ${formData.lotSizeUnit}`
                : undefined,
              interiorSize: formData.interiorSize && formData.interiorSizeUnit 
                ? `${formData.interiorSize} ${formData.interiorSizeUnit}`
                : undefined,
              highlights: formData.highlights,
              otherDetails: formData.otherDetails
            }} 
          />
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          disabled={saving}
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={handleGenerateDescription}
          disabled={saving}
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Generate Description
        </button>
      </div>

      {showAuthModal && (
        <GenerateAuthModal 
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  )
} 