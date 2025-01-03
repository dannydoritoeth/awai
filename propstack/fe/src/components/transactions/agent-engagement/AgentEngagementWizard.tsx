"use client"

import { useState, useEffect } from 'react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { SellerInformationForm } from '@/components/transactions/agent-engagement/steps/SellerInformationForm'
import { PropertyDetailsForm } from '@/components/transactions/agent-engagement/steps/PropertyDetailsForm'
import { PropertyFeaturesForm } from '@/components/transactions/agent-engagement/steps/PropertyFeaturesForm'
import { LegalComplianceForm } from '@/components/transactions/agent-engagement/steps/LegalComplianceForm'
import { ReviewForm } from '@/components/transactions/agent-engagement/steps/ReviewForm'
import { FormSteps } from '@/components/transactions/agent-engagement/FormSteps'
import { createEngagement, updateEngagement, getEngagement } from '@/services/engagements'
import { useRouter } from 'next/navigation'
import { PostgrestError } from '@supabase/supabase-js'
import { useAuth } from '@/contexts/AuthContext'
import { EngagementAuthModal } from './EngagementAuthModal'
import { toast } from 'react-hot-toast'

const initialFormData: AgentEngagementData = {
  // Status
  status: 'new',
  
  // Delivery Details
  deliveryMethod: 'email',
  requiredDateTime: '',
  
  // Seller Details
  sellerName: '',
  sellerAddress: '',
  sellerPhone: '',
  sellerEmail: '',
  
  // Property Details
  propertyAddress: '',
  spNumber: '',
  surveyPlanNumber: '',
  titleReference: '',
  saleMethod: 'private',
  listPrice: '',
  
  // Property Features
  propertyType: 'house',
  bedrooms: 0,
  bathrooms: 0,
  carSpaces: 0,
  pool: false,
  bodyCorp: false,
  electricalSafetySwitch: false,
  smokeAlarms: false,
  adviceToMarketPrice: false,
  
  // Compliance & Legal
  sellerWarranties: 'na',
  heritageListed: 'na',
  contaminatedLand: 'na',
  environmentManagement: 'na',
  presentLandUse: 'na',
  neighbourhoodDisputes: '',
  encumbrances: '',
  gstApplicable: '',
  authorisedMarketing: '',
  commission: 2.0
}

const steps = [
  'Property Details',
  'Seller Information',
  'Property Features',
  'Legal & Compliance',
  'Review'
]

const FORM_STORAGE_KEY = 'agent-engagement-draft'

export function AgentEngagementWizard({ id }: { id?: string }) {
  const [formData, setFormData] = useState<AgentEngagementData>(initialFormData)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  // Load saved draft from localStorage
  useEffect(() => {
    if (!id) {
      const savedData = localStorage.getItem(FORM_STORAGE_KEY)
      const savedStep = localStorage.getItem('currentStep')
      
      if (savedData) {
        try {
          setFormData(JSON.parse(savedData))
          if (savedStep) {
            setStep(parseInt(savedStep))
          }
        } catch (err) {
          console.error('Error parsing saved data:', err)
          localStorage.removeItem(FORM_STORAGE_KEY)
          localStorage.removeItem('currentStep')
        }
      }
    }
  }, [id])

  // Load existing engagement data when in edit mode
  useEffect(() => {
    if (id) {
      loadEngagement()
    }
  }, [id])

  async function loadEngagement() {
    try {
      setError(null)
      setLoading(true)
      const data = await getEngagement(id!)
      
      if (!data) {
        throw new Error('No engagement found')
      }

      // Map database fields (snake_case) to form data (camelCase)
      setFormData({
        status: data.status,
        deliveryMethod: data.delivery_method as 'email' | 'hardcopy',
        requiredDateTime: data.required_date_time,
        sellerName: data.seller_name,
        sellerAddress: data.seller_address,
        sellerPhone: data.seller_phone,
        sellerEmail: data.seller_email,
        propertyAddress: data.property_address,
        spNumber: data.sp_number,
        surveyPlanNumber: data.survey_plan_number,
        titleReference: data.title_reference,
        saleMethod: data.sale_method as 'private' | 'auction',
        listPrice: data.list_price,
        auctionDetails: data.auction_details,
        propertyType: data.property_type as 'house' | 'unit' | 'land' | 'other',
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        carSpaces: data.car_spaces,
        pool: data.pool,
        bodyCorp: data.body_corp,
        electricalSafetySwitch: data.electrical_safety_switch,
        smokeAlarms: data.smoke_alarms,
        adviceToMarketPrice: data.advice_to_market_price,
        tenancyDetails: data.tenancy_details,
        sellerWarranties: data.seller_warranties,
        heritageListed: data.heritage_listed,
        contaminatedLand: data.contaminated_land,
        environmentManagement: data.environment_management,
        presentLandUse: data.present_land_use,
        neighbourhoodDisputes: data.neighbourhood_disputes,
        encumbrances: data.encumbrances,
        gstApplicable: data.gst_applicable,
        authorisedMarketing: data.authorised_marketing,
        commission: data.commission
      })
    } catch (err) {
      const error = err as Error | PostgrestError
      console.error('Error loading engagement:', error)
      setError(error.message || 'Failed to load engagement')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (updates: Partial<AgentEngagementData>) => {
    setFormData(current => ({ ...current, ...updates }))
  }

  const handleNext = () => {
    setStep(s => Math.min(s + 1, steps.length))
  }

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1))
  }

  const handleEditStep = (stepNumber: number) => {
    setStep(stepNumber)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    
    if (!user) {
      // Save form data and current step before showing auth modal
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData))
      localStorage.setItem('currentStep', step.toString())
      setShowAuthModal(true)
      setLoading(false)
      return
    }

    try {
      if (id) {
        await updateEngagement(id, formData)
        toast.success('Changes saved successfully')
        router.push(`/transactions/agent-engagement/${id}`)
      } else {
        const newEngagement = await createEngagement(formData)
        localStorage.removeItem(FORM_STORAGE_KEY)
        localStorage.removeItem('currentStep')
        toast.success('Engagement created successfully')
        router.push(`/transactions/agent-engagement/${newEngagement.id}?new=true`)
      }
    } catch (err) {
      const error = err as Error | PostgrestError
      console.error('Error saving engagement:', error)
      setError(error.message || 'Failed to save engagement')
      toast.error('Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
  }

  if (loading && id) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <FormSteps steps={steps} currentStep={step} />
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Form Steps */}
      {step === 1 && (
        <PropertyDetailsForm
          formData={formData}
          onChange={handleChange}
          onNext={handleNext}
          isFirstStep={true}
        />
      )}
      {step === 2 && (
        <SellerInformationForm
          formData={formData}
          onChange={handleChange}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 3 && (
        <PropertyFeaturesForm
          formData={formData}
          onChange={handleChange}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 4 && (
        <LegalComplianceForm
          formData={formData}
          onChange={handleChange}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 5 && (
        <ReviewForm
          formData={formData}
          onSubmit={handleSubmit}
          onBack={handleBack}
          loading={loading}
          mode={id ? 'view' : 'create'}
        />
      )}

      {showAuthModal && (
        <EngagementAuthModal 
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
} 