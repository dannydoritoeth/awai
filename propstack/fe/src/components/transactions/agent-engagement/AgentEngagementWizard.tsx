"use client"

import { useState } from 'react'
import { Form6Data } from './types'
import { DeliveryDetailsForm } from './steps/DeliveryDetailsForm'
import { SellerInformationForm } from './steps/SellerInformationForm'
import { PropertyDetailsForm } from './steps/PropertyDetailsForm'
import { PropertyFeaturesForm } from './steps/PropertyFeaturesForm'
import { LegalComplianceForm } from './steps/LegalComplianceForm'
import { ReviewForm } from './steps/ReviewForm'
import { FormSteps } from './FormSteps'

const initialFormData: Form6Data = {
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
  titleReference: '',
  spNumber: '',
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
  neighbourhoodDisputes: false,
  encumbrances: false,
  gstApplicable: false,
  commission: 2.0,
  authorisedMarketing: false
}

const steps = [
  'Delivery Details',
  'Property Details',
  'Seller Information',
  'Property Features',
  'Legal & Compliance',
  'Review'
]

export function AgentEngagementWizard() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Form6Data>(initialFormData)

  const handleNext = () => {
    setStep(current => current + 1)
  }

  const handleBack = () => {
    setStep(current => current - 1)
  }

  const handleSubmit = async () => {
    // Handle form submission
    console.log('Form submitted:', formData)
  }

  const updateFormData = (updates: Partial<Form6Data>) => {
    setFormData(current => ({ ...current, ...updates }))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <FormSteps steps={steps} currentStep={step} />
      
      {/* Form Steps */}
      {step === 1 && (
        <DeliveryDetailsForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
        />
      )}
      {step === 2 && (
        <PropertyDetailsForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 3 && (
        <SellerInformationForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 4 && (
        <PropertyFeaturesForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 5 && (
        <LegalComplianceForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 6 && (
        <ReviewForm
          formData={formData}
          onSubmit={handleSubmit}
          onBack={handleBack}
        />
      )}
    </div>
  )
} 