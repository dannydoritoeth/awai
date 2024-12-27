import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

interface CaptionOptions {
  style: 'professional' | 'casual' | 'luxury'
  focus: ('features' | 'atmosphere' | 'selling_points')[]
  tone: 'neutral' | 'enthusiastic' | 'sophisticated'
  length: 'short' | 'medium' | 'long'
  includeKeywords: string
}

// Initialize Supabase client with service role key for direct DB access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generatePrompt(options: CaptionOptions) {
  const lengthGuide = {
    short: 'under 50 characters',
    medium: '50-100 characters',
    long: '100-150 characters'
  }[options.length]

  const styleGuide = {
    professional: 'Use professional and precise language',
    casual: 'Use casual and friendly language',
    luxury: 'Use sophisticated and upscale language'
  }[options.style]

  const toneGuide = {
    neutral: 'Maintain a neutral and factual tone',
    enthusiastic: 'Be enthusiastic and engaging',
    sophisticated: 'Use refined and elegant language'
  }[options.tone]

  const focusAreas = options.focus.map((focus) => {
    switch (focus) {
      case 'features': return 'physical features and details'
      case 'atmosphere': return 'mood and atmosphere'
      case 'selling_points': return 'key selling points'
    }
  }).join(', ')

  const keywordInstruction = options.includeKeywords
    ? `Try to naturally incorporate these keywords where relevant: ${options.includeKeywords}.`
    : ''

  return `Generate a concise, descriptive caption for this real estate listing image.
${styleGuide}. ${toneGuide}.
Focus on these aspects: ${focusAreas}.
Keep the caption ${lengthGuide}.
${keywordInstruction}
Make it compelling and market-ready.`
}

async function generateCaption(imageUrl: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: imageUrl }
          ]
        }
      ],
      max_tokens: 150
    })
  })

  if (!response.ok) {
    throw new Error('OpenAI API request failed')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content
}

export async function POST(request: Request) {
  try {
    const { listingId, options } = await request.json()

    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      )
    }

    // Validate options
    if (!options || !options.style || !options.focus || !options.tone || !options.length) {
      return NextResponse.json(
        { error: 'Invalid caption options provided' },
        { status: 400 }
      )
    }

    // Get all images for this listing
    const { data: images, error: fetchError } = await supabase
      .from('listing_images')
      .select('id, url')
      .eq('listing_id', listingId)
      .order('order_index')

    if (fetchError) {
      throw fetchError
    }

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No images found for this listing' },
        { status: 404 }
      )
    }

    // Process images in batches of 5
    const batchSize = 5
    const batches = []
    for (let i = 0; i < images.length; i += batchSize) {
      batches.push(images.slice(i, i + batchSize))
    }

    const prompt = generatePrompt(options as CaptionOptions)

    for (const batch of batches) {
      // Get signed URLs for the batch
      const batchWithUrls = await Promise.all(
        batch.map(async (image) => {
          const { data } = await supabase.storage
            .from('listing-images')
            .createSignedUrl(image.url, 3600)
          
          return {
            ...image,
            signedUrl: data?.signedUrl
          }
        })
      )

      // Generate captions for the batch
      const captionPromises = batchWithUrls.map(async (image) => {
        if (!image.signedUrl) return null

        const caption = await generateCaption(image.signedUrl, prompt)

        if (caption) {
          // Update the database with the generated caption
          const { error: updateError } = await supabase
            .from('listing_images')
            .update({ caption })
            .eq('id', image.id)

          if (updateError) throw updateError

          return {
            id: image.id,
            caption
          }
        }

        return null
      })

      await Promise.all(captionPromises)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Captions generated successfully'
    })
  } catch (error) {
    console.error('Error generating captions:', error)
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    )
  }
} 