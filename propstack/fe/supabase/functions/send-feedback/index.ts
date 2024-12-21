import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const adminEmail = Deno.env.get('ADMIN_EMAIL')

Deno.serve(async (req) => {
  try {
    const { context, message, userEmail } = await req.json()

    // Send email notification
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: adminEmail,
      subject: `New ${context} request from ${userEmail}`,
      text: `
Context: ${context}
From: ${userEmail}
Message: ${message}
      `
    })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}) 