import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders })

  try {
    const { userId, level, lessonId } = await req.json()

    let query = supabase
      .from(`${level}TestResults`)
      .select('*')
      .eq('user_id', userId)

    if (lessonId) {
      if (lessonId.includes('Part')) {
        const part = lessonId.replace('Part', 'Part')
        query = query.ilike('test_id', `%Progress-${part}%`)
      } else {
        query = query.ilike('test_id', `%${lessonId}-Test%`)
      }
    }

    const { data, error } = await query

    if (error) throw error

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})
