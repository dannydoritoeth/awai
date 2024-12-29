import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRequest {
  listingId: string
  contentId: string
  options: {
    useEmojis: boolean
    tone: string
    platforms: string[]
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openai = new OpenAIApi(
      new Configuration({
        apiKey: Deno.env.get('OPENAI_API_KEY'),
      })
    )

    // Get request data
    const { listingId, contentId, options } = await req.json() as GenerateRequest

    // Fetch listing data
    const { data: listing, error: listingError } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single()

    if (listingError) throw listingError

    // Fetch content data to get post type
    const { data: content, error: contentError } = await supabaseClient
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single()

    if (contentError) throw contentError

    // Generate content for each platform
    const generatedContent: Record<string, string> = {}
    
    for (const platform of options.platforms) {
      const prompt = generatePrompt(listing, content.post_type, platform, options)
      
      const completion = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional social media content writer for real estate. Your task is to create engaging, platform-appropriate content that drives engagement and interest in property listings."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })

      const text = completion.data.choices[0]?.message?.content
      if (text) {
        generatedContent[platform] = text.trim()
      }
    }

    // Update content record with generated content and options
    const { error: updateError } = await supabaseClient
      .from('social_media_content')
      .update({
        content_options: options,
        generated_content: generatedContent,
        status: 'ready'
      })
      .eq('id', contentId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

function generatePrompt(
  listing: any,
  postType: string,
  platform: string,
  options: { useEmojis: boolean; tone: string }
): string {
  const basePrompt = `Create a ${platform} post for a ${listing.property_type} ${listing.listing_type === 'sale' ? 'for sale' : 'for rent'} at ${listing.address}.

Property Details:
- Price: ${listing.price}
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Parking: ${listing.parking}
${listing.lot_size ? `- Lot Size: ${listing.lot_size} ${listing.lot_size_unit}` : ''}
${listing.interior_size ? `- Interior Size: ${listing.interior_size} ${listing.interior_size_unit}` : ''}

Post Type: ${postType}
Writing Tone: ${options.tone}
${options.useEmojis ? 'Please include relevant emojis.' : 'Do not use emojis.'}

Platform-specific requirements:
${platform === 'twitter' ? '- Maximum 280 characters' : ''}
${platform === 'instagram' ? '- Include relevant hashtags\n- Emoji-friendly' : ''}
${platform === 'facebook' ? '- Conversational tone\n- Can be longer form' : ''}
${platform === 'linkedin' ? '- Professional tone\n- Focus on investment/business aspects' : ''}

Additional Notes:
- Highlight key features and benefits
- Include a clear call to action
- Make it engaging and shareable
${listing.property_highlights?.length ? `\nProperty Highlights:\n${listing.property_highlights.map((h: string) => `- ${h}`).join('\n')}` : ''}
${listing.location_highlights?.length ? `\nLocation Highlights:\n${listing.location_highlights.map((h: string) => `- ${h}`).join('\n')}` : ''}`

  return basePrompt
} 