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
  contentLength: "short" | "medium" | "long"
  callToAction: {
    type: "none" | "learn_more" | "contact" | "schedule" | "custom"
    customText?: string
    link?: string
  }
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

const generatePrompt = (listing: any, options: any, platform: string) => {
  const lengthGuideline = getContentLengthGuideline(options.contentLength)
  const toneGuideline = `Use a ${options.tone} tone.`
  const emojiGuideline = options.useEmojis ? 'Include relevant emojis.' : 'Do not use emojis.'
  
  // More explicit CTA handling
  let ctaGuideline = ''
  if (options.callToAction.type !== 'none') {
    const ctaType = options.callToAction.type === 'custom' 
      ? options.callToAction.customText 
      : {
          'learn_more': 'Learn more about this property',
          'contact': 'Contact us for more information',
          'schedule': 'Schedule a viewing today'
        }[options.callToAction.type]
    
    ctaGuideline = `End with this specific call to action: "${ctaType}"${options.callToAction.link ? ` and direct users to ${options.callToAction.link}` : ''}.`
  }

  // Platform-specific formatting guidelines
  const formatGuidelines = {
    facebook: `Format the content with clear line breaks between sections.
Use emojis (if enabled) at the start of key points.
If including a link, place it at the end after the call to action.`,
    instagram: `Format with line breaks between sections.
Use emojis (if enabled) strategically throughout.
Add 3-5 relevant hashtags at the end (e.g., #RealEstate #LuxuryHomes #PropertyForSale).
Keep hashtags separate from the main content with a line break.`,
    linkedin: `Format with professional line breaks between sections.
Use bullet points for key features.
Keep the tone more formal and business-focused.
If including a link, place it at the end after the call to action.`
  }[platform]
  
  let prompt = `Write a ${options.post_type} post for a real estate property, formatted specifically for ${platform}.
${lengthGuideline}
${toneGuideline}
${emojiGuideline}
${formatGuidelines}
${ctaGuideline}

Property details:
- Address: ${listing.address}
- Price: ${listing.price}
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Square Feet: ${listing.square_feet}

${options.agentContext ? `Agent's perspective: ${options.agentContext}` : ''}
${options.customContext ? `Additional context: ${options.customContext}` : ''}

Generate the post with appropriate formatting and line breaks. Do not include any explanations.`

  return prompt
}

// Update the content generation to pass the platform
const generateContent = async (listing: any, options: any, platform: string, isAd: boolean) => {
  const prompt = generatePrompt(listing, options, platform)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: isAd 
          ? `You are a professional real estate advertising copywriter. Create compelling ad copy for ${platform}, using appropriate formatting and structure for the platform. Focus on creating urgency and highlighting unique value propositions${options.post_type === 'custom' ? ' while incorporating the provided custom context' : ''}.`
          : `You are a professional real estate social media manager. Create engaging ${platform} content with appropriate formatting and structure. Write in a ${options.tone} tone and focus on the unique selling points${options.post_type === 'custom' ? ' while incorporating the provided custom context' : ''}.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  })

  return completion.choices[0].message.content || ''
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
          generatedContent[`${platform}_organic`] = await generateContent(listing, options, platform, false)
        }

        // Generate ad copy if selected
        if (settings.ad) {
          generatedContent[`${platform}_ad`] = await generateContent(listing, options, platform, true)
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