"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeading } from '@/components/layout/PageHeading'
import { ReviewForm } from '@/components/transactions/agent-engagement/steps/ReviewForm'
import { EngagementActions } from './EngagementActions'
import { EngagementWorkflowPanel } from './EngagementWorkflowPanel'
import { EngagementLinkedListing } from './EngagementLinkedListing'
import { EngagementChecklistPanel } from './EngagementChecklistPanel'
import { AgentEngagementData, EngagementStatus } from './types'

interface EngagementDetailPageProps {
  id: string
}

interface LinkedListing {
  id: string
  address: string
  status: string
}

export function EngagementDetailPage({ id }: EngagementDetailPageProps) {
  const [engagement, setEngagement] = useState<AgentEngagementData | null>(null)
  const [linkedListing, setLinkedListing] = useState<LinkedListing | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch engagement
        const { data: engagementData, error: engagementError } = await supabase
          .from('agent_engagements')
          .select('*')
          .eq('id', id)
          .single()

        if (engagementError) {
          console.error('Error fetching engagement:', engagementError)
          return
        }

        // Transform snake_case database fields to camelCase for the form
        const transformedData: AgentEngagementData = {
          status: engagementData.status as EngagementStatus,
          deliveryMethod: engagementData.delivery_method as 'email' | 'hardcopy',
          requiredDateTime: engagementData.required_date_time,
          sellerName: engagementData.seller_name,
          sellerAddress: engagementData.seller_address,
          sellerPhone: engagementData.seller_phone,
          sellerEmail: engagementData.seller_email,
          propertyAddress: engagementData.property_address,
          spNumber: engagementData.sp_number,
          surveyPlanNumber: engagementData.survey_plan_number,
          titleReference: engagementData.title_reference,
          saleMethod: engagementData.sale_method as 'private' | 'auction',
          listPrice: engagementData.list_price,
          auctionDetails: engagementData.auction_details,
          propertyType: engagementData.property_type as 'house' | 'unit' | 'land' | 'other',
          bedrooms: engagementData.bedrooms,
          bathrooms: engagementData.bathrooms,
          carSpaces: engagementData.car_spaces,
          pool: engagementData.pool,
          bodyCorp: engagementData.body_corp,
          electricalSafetySwitch: engagementData.electrical_safety_switch,
          smokeAlarms: engagementData.smoke_alarms,
          adviceToMarketPrice: engagementData.advice_to_market_price,
          tenancyDetails: engagementData.tenancy_details,
          sellerWarranties: engagementData.seller_warranties,
          heritageListed: engagementData.heritage_listed,
          contaminatedLand: engagementData.contaminated_land,
          environmentManagement: engagementData.environment_management,
          presentLandUse: engagementData.present_land_use,
          neighbourhoodDisputes: engagementData.neighbourhood_disputes,
          encumbrances: engagementData.encumbrances,
          gstApplicable: engagementData.gst_applicable,
          authorisedMarketing: engagementData.authorised_marketing,
          commission: engagementData.commission
        }

        setEngagement(transformedData)

        // Fetch linked listing
        const { data: listingData, error: listingError } = await supabase
          .from('listings')
          .select('id, address, status')
          .eq('agent_engagement_id', id)
          .single()

        if (listingError && listingError.code !== 'PGRST116') {
          console.error('Error fetching linked listing:', listingError)
        } else if (listingData) {
          setLinkedListing(listingData)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="h-full p-8">
        <div className="flex justify-center">
          <Spinner />
        </div>
      </div>
    )
  }

  if (!engagement) {
    return (
      <div className="h-full p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Engagement not found</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Agent Engagement"
        description="Review and manage agent engagement"
        backHref="/transactions/agent-engagement"
        showBackButton
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Review Form */}
        <div className="lg:col-span-2">
          <ReviewForm 
            formData={engagement}
            readOnly
            mode="view"
            onSubmit={() => {}}
          />
        </div>

        {/* Right column - Actions */}
        <div className="space-y-6">
          {/* Checklist Panel */}
          <EngagementChecklistPanel engagementId={id} />

          {/* Workflow Panel */}
          <EngagementWorkflowPanel engagementId={id} />

          {/* Actions Panel */}
          <EngagementActions 
            engagementId={id}
            status={engagement.status}
          />

          {/* Linked Listing */}
          {linkedListing && (
            <EngagementLinkedListing listing={linkedListing} />
          )}
        </div>
      </div>
    </div>
  )
} 