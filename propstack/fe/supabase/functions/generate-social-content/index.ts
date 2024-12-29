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

// Add content length guidelines to the prompt
const getContentLengthGuideline = (length: string) => {
  switch (length) {
    case 'short':
      return 'Keep the response to 1-2 concise sentences.'
    case 'medium':
      return 'Keep the response to 2-3 sentences.'
    case 'long':
      return 'Write 3-4 detailed sentences.'
    default:
      return 'Keep the response to 2-3 sentences.'
  }
}

const generatePrompt = (listing: any, options: any) => {
  const lengthGuideline = getContentLengthGuideline(options.contentLength)
  const toneGuideline = `Use a ${options.tone} tone.`
  const emojiGuideline = options.useEmojis ? 'Include relevant emojis.' : 'Do not use emojis.'
  const ctaGuideline = options.callToAction.type !== 'none' 
    ? `Include a call to action: ${options.callToAction.type === 'custom' ? options.callToAction.customText : options.callToAction.type}.` 
    : ''
  
  let prompt = `Write a ${options.post_type} post for a real estate property.
${lengthGuideline}
${toneGuideline}
${emojiGuideline}
${ctaGuideline}

Property details:
- Address: ${listing.address}
- Price: ${listing.price}
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Square Feet: ${listing.square_feet}

${options.agentContext ? `Agent's perspective: ${options.agentContext}` : ''}
${options.customContext ? `Additional context: ${options.customContext}` : ''}

Generate ONLY the post content, without any explanations or formatting.`

  return prompt
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
          const prompt = generatePrompt(listing, {
            post_type: content.post_type,
            customContext: content.custom_context,
            agentContext: options.agentContext,
            tone: options.tone,
            useEmojis: options.useEmojis,
            contentLength: 'medium',
            callToAction: {
              type: 'none'
            }
          })

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
          const prompt = generatePrompt(listing, {
            post_type: content.post_type,
            customContext: content.custom_context,
            agentContext: options.agentContext,
            tone: options.tone,
            useEmojis: options.useEmojis,
            contentLength: 'medium',
            callToAction: {
              type: 'none'
            }
          })

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