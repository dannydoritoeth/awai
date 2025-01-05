"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingWizard } from '@/components/listings/ListingWizard'
import { Spinner } from '@/components/ui/Spinner'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { useMaps } from '@/contexts/MapsContext'
import { use } from 'react'

interface PageParams {
  id: string
}

interface CreateListingPageProps {
  params: Promise<PageParams>
}

export default function CreateListingPage({ params }: CreateListingPageProps) {
  const { id } = use(params)
  const [engagement, setEngagement] = useState<AgentEngagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const router = useRouter()
  const { isLoaded } = useMaps()

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
        status: data.status,
        deliveryMethod: data.delivery_method,
        requiredDateTime: data.required_date_time,
        sellerName: data.seller_name,
        sellerAddress: data.seller_address,
        sellerPhone: data.seller_phone,
        sellerEmail: data.seller_email,
        propertyAddress: data.property_address,
        spNumber: data.sp_number,
        surveyPlanNumber: data.survey_plan_number,
        titleReference: data.title_reference,
        saleMethod: data.sale_method,
        listPrice: data.list_price,
        auctionDetails: data.auction_details,
        propertyType: data.property_type,
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
      
      // Get coordinates and place_id for the property address
      if (isLoaded && window.google) {
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode(
          { address: data.property_address },
          (results, status) => {
            if (status === 'OK' && results?.[0]) {
              const location = results[0].geometry.location
              setCoordinates({
                lat: location.lat(),
                lng: location.lng()
              })
              setPlaceId(results[0].place_id)
            }
          }
        )
      }
      
      setLoading(false)
    }

    fetchEngagement()
  }, [id, isLoaded])

  if (loading || !isLoaded) {
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

  // Map engagement data to listing form data
  const initialListingData = {
    address: engagement.propertyAddress,
    latitude: coordinates?.lat,
    longitude: coordinates?.lng,
    placeId: placeId,
    addressSelected: Boolean(coordinates && placeId),
    propertyType: engagement.propertyType === 'house' ? 'house' : 
                 engagement.propertyType === 'unit' ? 'apartment' :
                 engagement.propertyType === 'land' ? 'land' : 'other',
    listingType: engagement.saleMethod === 'private' ? 'sale' : 'auction',
    price: engagement.listPrice,
    currency: '$',
    bedrooms: engagement.bedrooms,
    bathrooms: engagement.bathrooms,
    parking: engagement.carSpaces,
    agent_engagement_id: id
  }

  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Create Listing"
        description="Create a new listing from agent engagement"
        backHref={`/transactions/agent-engagement/${id}`}
        showBackButton
      />

      <div className="mt-8">
        <ListingWizard 
          initialData={initialListingData}
          mode="create"
        />
      </div>
    </div>
  )
} 