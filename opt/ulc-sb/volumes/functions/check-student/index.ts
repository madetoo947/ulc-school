// supabase/functions/check-student/index.ts

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { corsHeaders } from '../cors.ts'

const API_1C_BASE_URL = Deno.env.get('API_1C_BASE_URL')

function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Телефон не указан' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const auth = toBase64Utf8(
      `${Deno.env.get('API_1C_USER')}:${Deno.env.get('API_1C_PASS')}`
    )

    const response = await fetch(
      `${API_1C_BASE_URL}/student_by_contacts?number=${encodeURIComponent(
        phone
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return new Response(
        JSON.stringify({ result: false, error: 'Студент не найден' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
