"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeading } from '@/components/layout/PageHeading'
import { ReviewForm } from '@/components/transactions/agent-engagement/steps/ReviewForm'
import { EngagementActions } from '@/components/transactions/agent-engagement/EngagementActions'
import { AgentEngagementData, EngagementStatus } from '@/components/transactions/agent-engagement/types'

interface EngagementDetailPageProps {
  id: string
}

export function EngagementDetailPage({ id }: EngagementDetailPageProps) {
  const [engagement, setEngagement] = useState<AgentEngagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchEngagement = async () => {
      const { data, error } = await supabase
        .from('agent_engagements')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching engagement:', error)
        return
      }

      // Transform snake_case database fields to camelCase for the form
      const transformedData: AgentEngagementData = {
        status: data.status as EngagementStatus,
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
      }

      setEngagement(transformedData)
      setLoading(false)
    }

    fetchEngagement()
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
          <EngagementActions 
            engagementId={id}
            status={engagement.status}
          />
        </div>
      </div>
    </div>
  )
} 