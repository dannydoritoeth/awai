/// <reference lib="deno.ns" />

// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from '@supabase/supabase-js'
import { OpenAI } from "jsr:@openai/openai"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const serviceRoleUrl = Deno.env.get('SERVICE_ROLE_URL')
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

const supabase = createClient(serviceRoleUrl!, serviceRoleKey!)

interface ListingData {
  id: string
  address: string
  unit_number?: string
  listing_type: string
  property_type: string
  price?: string
  bedrooms?: string
  bathrooms?: string
  parking?: string
  lot_size?: string
  lot_size_unit?: string
  interior_size?: string
  highlights: string[]
  other_details?: string
  language: string
  target_length: number
  target_unit: string
}

console.log("Hello from Functions!")

Deno.serve(async (req: Request) => {
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Get listing data from request
    const data: ListingData = await req.json()

    // Build the prompt
    const prompt = `Generate a compelling real estate description for the following property:

Address: ${data.address}${data.unit_number ? ` Unit ${data.unit_number}` : ''}
Type: ${data.property_type} for ${data.listing_type}
${data.price ? `Price: $${data.price}` : ''}
${data.bedrooms ? `Bedrooms: ${data.bedrooms}` : ''}
${data.bathrooms ? `Bathrooms: ${data.bathrooms}` : ''}
${data.parking ? `Parking: ${data.parking}` : ''}
${data.lot_size ? `Lot Size: ${data.lot_size} ${data.lot_size_unit}` : ''}
${data.interior_size ? `Interior Size: ${data.interior_size}` : ''}
Highlights: ${data.highlights.join(', ')}
${data.other_details ? `Additional Details: ${data.other_details}` : ''}

Please write a ${data.target_length} ${data.target_unit} description in ${data.language}. 
Focus on the property's unique features and benefits. 
Use a professional tone and avoid clichés.
Highlight the location and any special amenities.`

    // Generate description with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an experienced real estate copywriter who creates compelling property descriptions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const description = completion.choices[0].message.content

    // Save to database
    const { error: dbError } = await supabase
      .from('generated_descriptions')
      .insert({
        listing_id: data.id,
        content: description,
        language: data.language,
        target_length: data.target_length,
        target_unit: data.target_unit,
        version: 1,
        is_selected: true,
        prompt_used: prompt,
        model_used: 'gpt-4'
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ description }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-description' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
