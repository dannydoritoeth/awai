"use client"

import { useState, useEffect } from 'react'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ListingFormData } from '@/types'
import { GenerateAuthModal } from '@/components/marketing/descriptions/GenerateAuthModal'

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

  async function handleGenerateDescription() {
    setSaving(true)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Save current form data before showing auth modal
        localStorage.setItem('pendingListingData', JSON.stringify({
          formData,
          language,
          length,
          unit
        }))
        setSaving(false)
        setShowAuthModal(true)
        return
      }

      // Check for pending data after auth
      const pendingData = localStorage.getItem('pendingListingData')
      const dataToUse = pendingData ? JSON.parse(pendingData) : { formData, language, length, unit }

      // First create listing with pending description
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          user_id: session.user.id,
          address: dataToUse.formData.address,
          unit_number: dataToUse.formData.unitNumber,
          listing_type: dataToUse.formData.listingType,
          property_type: dataToUse.formData.propertyType,
          price: dataToUse.formData.price,
          bedrooms: dataToUse.formData.bedrooms,
          bathrooms: dataToUse.formData.bathrooms,
          parking: dataToUse.formData.parking,
          lot_size: dataToUse.formData.lotSize,
          lot_size_unit: dataToUse.formData.lotSizeUnit,
          interior_size: dataToUse.formData.interiorSize,
          highlights: dataToUse.formData.highlights,
          other_details: dataToUse.formData.otherDetails,
          language: dataToUse.language
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Clear pending data after successful save
      localStorage.removeItem('pendingListingData')

      // Create pending description
      const { data: description, error: descError } = await supabase
        .from('generated_descriptions')
        .insert({
          listing_id: listing.id,
          content: 'Generating...',
          language: dataToUse.language,
          target_length: parseInt(dataToUse.length),
          target_unit: dataToUse.unit.toLowerCase(),
          version: 1,
          is_selected: true,
          status: 'processing'
        })
        .select()
        .single()

      if (descError) throw descError

      // Call edge function to generate description
      const { data, error: functionError } = await supabase.functions.invoke<{ description: string }>(
        'generate-description',
        {
          body: {
            id: listing.id,
            ...dataToUse.formData,
            language: dataToUse.language,
            target_length: parseInt(dataToUse.length),
            target_unit: dataToUse.unit
          }
        }
      )

      if (functionError) {
        throw new Error(`Failed to generate description: ${functionError.message}`)
      }

      if (!data?.description) {
        throw new Error('No description returned from function')
      }

      router.push(`/marketing/listings/${listing.id}`)
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to save listing. Please try again.')
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
          <div className="mt-4 space-y-4 text-gray-700">
            <div>
              <span className="font-medium">Address:</span>{' '}
              {formData.address}
              {formData.unitNumber && ` Unit ${formData.unitNumber}`}
            </div>
            <div>
              <span className="font-medium">Type:</span>{' '}
              {formData.propertyType.charAt(0).toUpperCase() + formData.propertyType.slice(1)} for {formData.listingType}
            </div>
            {formData.price && (
              <div>
                <span className="font-medium">Price:</span> ${formData.price}
              </div>
            )}
            {formData.bedrooms && (
              <div>
                <span className="font-medium">Bedrooms:</span> {formData.bedrooms}
              </div>
            )}
            {formData.bathrooms && (
              <div>
                <span className="font-medium">Bathrooms:</span> {formData.bathrooms}
              </div>
            )}
            {formData.parking && (
              <div>
                <span className="font-medium">Parking:</span> {formData.parking}
              </div>
            )}
            {formData.lotSize && (
              <div>
                <span className="font-medium">Lot Size:</span> {formData.lotSize} {formData.lotSizeUnit}
              </div>
            )}
            {formData.interiorSize && (
              <div>
                <span className="font-medium">Interior Size:</span> {formData.interiorSize}
              </div>
            )}
            <div>
              <span className="font-medium">Property Highlights:</span>{' '}
              {formatHighlights(formData.highlights)}
            </div>
            {formData.otherDetails && (
              <div>
                <span className="font-medium">Other Details:</span>{' '}
                {formData.otherDetails}
              </div>
            )}
          </div>
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
          {saving ? 'Generating...' : 'Generate Description'}
        </button>
      </div>

      {showAuthModal && (
        <GenerateAuthModal 
          onClose={() => setShowAuthModal(false)}
          onAuth={handleGenerateDescription}
        />
      )}
    </div>
  )
} 