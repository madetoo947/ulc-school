// /opt/ulc-sb/volumes/functions/text-to-speech/index.ts

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { corsHeaders } from '../cors.ts'

const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY')

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, languageCode, voiceName, ssmlGender, audioEncoding } = await req.json()

    if (!text) {
      return new Response(JSON.stringify({ error: 'Текст не указан' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: languageCode || 'en-US',
            name: voiceName || 'en-US-Wavenet-D',
            ssmlGender: ssmlGender || 'MALE',
          },
          audioConfig: {
            audioEncoding: audioEncoding || 'MP3',
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return new Response(JSON.stringify({ error: 'Ошибка синтеза речи', details: error }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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