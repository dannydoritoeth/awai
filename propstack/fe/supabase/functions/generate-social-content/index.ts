import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

console.log('Loading generate-social-content function...')

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface PlatformOptions {
  organic: boolean
  ad: boolean
}

type Platform = "facebook" | "instagram" | "twitter" | "linkedin"

interface GenerationOptions {
  post_type: string
  customContext: string
  agentContext: string
  tone: string
  useEmojis: boolean
  platforms: Platform[]
  generateAdCopy: boolean
  selectedPlatforms: {
    [key in Platform]: PlatformOptions
  }
}

interface GenerateRequest {
  listingId: string
  contentId: string
  options: GenerationOptions
}

const PLATFORM_LIMITS = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse and validate request body
    const bodyText = await req.text()
    console.log('Raw request body:', bodyText)

    const body = bodyText ? JSON.parse(bodyText) as GenerateRequest : null
    if (!body) {
      throw new Error('Request body is empty')
    }

    const { listingId, contentId, options } = body
    console.log('Parsed request data:', { listingId, contentId, options })

    // Create Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Fetch listing details and content
    const [listingRes, contentRes] = await Promise.all([
      supabaseClient
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single(),
      supabaseClient
        .from('social_media_content')
        .select('*')
        .eq('id', contentId)
        .single()
    ])

    if (listingRes.error) {
      console.error('Error fetching listing:', listingRes.error)
      throw new Error('Failed to fetch listing details')
    }
    if (contentRes.error) {
      console.error('Error fetching content:', contentRes.error)
      throw new Error('Failed to fetch content details')
    }

    const listing = listingRes.data
    const content = contentRes.data

    // Generate content for each platform
    const generatedContent: Record<string, string> = {}
    
    // Get list of platforms that need content (either organic or ad)
    const platformsToGenerate = Object.entries(options.selectedPlatforms)
      .filter(([_, settings]) => settings.organic || settings.ad)
      .map(([platform]) => platform as Platform)

    for (const platform of platformsToGenerate) {
      const settings = options.selectedPlatforms[platform]
      
      try {
        // Generate organic post if selected
        if (settings.organic) {
          const prompt = `Generate a ${platform} post for a real estate listing with the following details:
        
Address: ${listing.address}
Price: ${listing.price}
Bedrooms: ${listing.bedrooms}
Bathrooms: ${listing.bathrooms}
Square Feet: ${listing.interior_size}
Description: ${listing.description || ''}

Post Type: ${content.post_type}${content.post_type === 'custom' ? `\nCustom Post Context: ${content.custom_context}` : ''}
Writing Tone: ${options.tone}
${options.useEmojis ? 'Include relevant emojis' : 'Do not use emojis'}

${options.agentContext ? `Additional Context: ${options.agentContext}` : ''}

Character Limit: ${PLATFORM_LIMITS[platform]}

Generate a compelling and engaging organic post that highlights the key features and benefits of this property${content.post_type === 'custom' ? ' based on the provided custom context' : ''}.`

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `You are a professional real estate social media manager. Your task is to create engaging social media content for real estate listings. Write in a ${options.tone} tone and focus on the unique selling points of the property${content.post_type === 'custom' ? ' while incorporating the provided custom context' : ''}.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          })

          generatedContent[`${platform}_organic`] = completion.choices[0].message.content || ''
        }

        // Generate ad copy if selected
        if (settings.ad) {
          const prompt = `Generate ${platform} ad copy for a real estate listing with the following details:
        
Address: ${listing.address}
Price: ${listing.price}
Bedrooms: ${listing.bedrooms}
Bathrooms: ${listing.bathrooms}
Square Feet: ${listing.interior_size}
Description: ${listing.description || ''}

Post Type: ${content.post_type}${content.post_type === 'custom' ? `\nCustom Post Context: ${content.custom_context}` : ''}
Writing Tone: ${options.tone}
${options.useEmojis ? 'Include relevant emojis' : 'Do not use emojis'}

${options.agentContext ? `Additional Context: ${options.agentContext}` : ''}

Character Limit: ${PLATFORM_LIMITS[platform]}

Generate compelling ad copy that drives engagement and interest in this property. Focus on creating a sense of urgency and highlighting unique value propositions${content.post_type === 'custom' ? ' while incorporating the provided custom context' : ''}.`

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `You are a professional real estate advertising copywriter. Your task is to create compelling ad copy for real estate listings. Write in a ${options.tone} tone and focus on creating urgency and highlighting unique value propositions${content.post_type === 'custom' ? ' while incorporating the provided custom context' : ''}.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          })

          generatedContent[`${platform}_ad`] = completion.choices[0].message.content || ''
        }
      } catch (error) {
        console.error(`Error generating content for ${platform}:`, error)
        throw new Error(`Failed to generate content for ${platform}`)
      }
    }

    // Update content record with generated content
    const { error: updateError } = await supabaseClient
      .from('social_media_content')
      .update({
        content_options: options,
        generated_content: generatedContent,
        status: 'ready'
      })
      .eq('id', contentId)

    if (updateError) {
      console.error('Error updating content:', updateError)
      throw new Error('Failed to save generated content')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: generatedContent
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 