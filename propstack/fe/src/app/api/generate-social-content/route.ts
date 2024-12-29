import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const PLATFORM_LIMITS = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { listingId, contentId, options } = await request.json()

  try {
    // Fetch listing details and content
    const [listingRes, contentRes] = await Promise.all([
      supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single(),
      supabase
        .from('social_media_content')
        .select('*')
        .eq('id', contentId)
        .single()
    ])

    if (listingRes.error) throw listingRes.error
    if (contentRes.error) throw contentRes.error

    const listing = listingRes.data
    const content = contentRes.data

    // Generate content for each platform
    const generatedContent: Record<string, string> = {}
    for (const platform of options.platforms) {
      const prompt = `Generate a ${platform} post for a real estate listing with the following details:
      
Address: ${listing.address}
Price: ${listing.price}
Bedrooms: ${listing.bedrooms}
Bathrooms: ${listing.bathrooms}
Square Feet: ${listing.square_feet}
Description: ${listing.description}

Post Type: ${content.post_type}${content.post_type === 'custom' ? `\nCustom Post Context: ${content.custom_context}` : ''}
Writing Tone: ${options.tone}
${options.useEmojis ? 'Include relevant emojis' : 'Do not use emojis'}

Character Limit: ${PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS]}

Generate a compelling and engaging post that highlights the key features and benefits of this property${content.post_type === 'custom' ? ' based on the provided custom context' : ''}.`

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

      generatedContent[platform] = completion.choices[0].message.content || ''
    }

    // Update content record with generated content
    const { error: updateError } = await supabase
      .from('social_media_content')
      .update({
        content_options: options,
        generated_content: generatedContent,
        status: 'ready'
      })
      .eq('id', contentId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, data: generatedContent })
  } catch (error) {
    console.error('Error generating content:', error)
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    )
  }
} 