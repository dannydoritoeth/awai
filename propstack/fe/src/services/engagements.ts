import { supabase } from '@/lib/supabase'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { PostgrestError } from '@supabase/supabase-js'

export async function createEngagement(data: AgentEngagementData) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No authenticated user')

    const { data: engagement, error } = await supabase
      .from('agent_engagements')
      .insert([{
        user_id: user.id,
        delivery_method: data.deliveryMethod,
        required_date_time: data.requiredDateTime,
        seller_name: data.sellerName,
        seller_address: data.sellerAddress,
        seller_phone: data.sellerPhone,
        seller_email: data.sellerEmail,
        property_address: data.propertyAddress,
        sp_number: data.spNumber,
        survey_plan_number: data.surveyPlanNumber,
        title_reference: data.titleReference,
        sale_method: data.saleMethod,
        list_price: data.listPrice,
        auction_details: data.auctionDetails,
        property_type: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        car_spaces: data.carSpaces,
        pool: data.pool,
        body_corp: data.bodyCorp,
        electrical_safety_switch: data.electricalSafetySwitch,
        smoke_alarms: data.smokeAlarms,
        seller_warranties: data.sellerWarranties,
        heritage_listed: data.heritageListed,
        contaminated_land: data.contaminatedLand,
        environment_management: data.environmentManagement,
        present_land_use: data.presentLandUse,
        neighbourhood_disputes: data.neighbourhoodDisputes,
        encumbrances: data.encumbrances,
        gst_applicable: data.gstApplicable,
        authorised_marketing: data.authorisedMarketing,
        commission: data.commission,
        status: 'new'
      }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    return engagement
  } catch (err) {
    const error = err as Error | PostgrestError
    console.error('Error creating engagement:', error)
    throw error
  }
}

export async function updateEngagement(id: string, data: Partial<AgentEngagementData>) {
  try {
    const { data: engagement, error } = await supabase
      .from('agent_engagements')
      .update({
        delivery_method: data.deliveryMethod,
        required_date_time: data.requiredDateTime,
        seller_name: data.sellerName,
        seller_address: data.sellerAddress,
        seller_phone: data.sellerPhone,
        seller_email: data.sellerEmail,
        property_address: data.propertyAddress,
        sp_number: data.spNumber,
        survey_plan_number: data.surveyPlanNumber,
        title_reference: data.titleReference,
        sale_method: data.saleMethod,
        list_price: data.listPrice,
        auction_details: data.auctionDetails,
        property_type: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        car_spaces: data.carSpaces,
        pool: data.pool,
        body_corp: data.bodyCorp,
        electrical_safety_switch: data.electricalSafetySwitch,
        smoke_alarms: data.smokeAlarms,
        seller_warranties: data.sellerWarranties,
        heritage_listed: data.heritageListed,
        contaminated_land: data.contaminatedLand,
        environment_management: data.environmentManagement,
        present_land_use: data.presentLandUse,
        neighbourhood_disputes: data.neighbourhoodDisputes,
        encumbrances: data.encumbrances,
        gst_applicable: data.gstApplicable,
        authorised_marketing: data.authorisedMarketing,
        commission: data.commission
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    return engagement
  } catch (err) {
    const error = err as Error | PostgrestError
    console.error('Error updating engagement:', error)
    throw error
  }
}

export async function getEngagement(id: string) {
  try {
    const { data: engagement, error } = await supabase
      .from('agent_engagements')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null
      }
      console.error('Database error:', error)
      throw error
    }

    return engagement
  } catch (err) {
    const error = err as Error | PostgrestError
    console.error('Error getting engagement:', error)
    throw error
  }
}

export async function listEngagements() {
  try {
    const { data: engagements, error } = await supabase
      .from('agent_engagements')
      .select('id, property_address, seller_name, created_at, status')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    return engagements || []
  } catch (err) {
    const error = err as Error | PostgrestError
    console.error('Error listing engagements:', error)
    throw error
  }
}

export async function updateEngagementStatus(id: string, status: 'new' | 'title_search' | 'review' | 'agreement') {
  try {
    const { data: engagement, error } = await supabase
      .from('agent_engagements')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    return engagement
  } catch (err) {
    const error = err as Error | PostgrestError
    console.error('Error updating engagement status:', error)
    throw error
  }
} 