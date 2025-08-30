import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { corsHeaders } from '../cors.ts'

const API_1C_BASE_URL = Deno.env.get('API_1C_BASE_URL')

function toBase64Utf8(str: string): string {
  // Кодируем в Uint8Array с помощью TextEncoder и преобразуем в base64
  const bytes = new TextEncoder().encode(str)
  // btoa работает с бинарной строкой, поэтому нужно вручную сконвертировать байты в строку
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
    const { email } = await req.json()
    const auth = toBase64Utf8(
      `${Deno.env.get('API_1C_USER')}:${Deno.env.get('API_1C_PASS')}`
    )

    const res = await fetch(
      `${API_1C_BASE_URL}/students_by_teacher_email?email=${encodeURIComponent(
        email
      )}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Ошибка запроса к 1С' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
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
