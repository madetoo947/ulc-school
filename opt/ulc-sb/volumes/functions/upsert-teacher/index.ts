import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const teacherData = await req.json()

    // Валидация обязательных полей
    if (!teacherData.email) {
      throw new Error('Email is required')
    }

    // Подготавливаем данные для вставки
    const dataToInsert = {
      name: teacherData.name || null,
      email: teacherData.email,
      role: teacherData.role || 'teacher',
    }

    // Upsert операция с конфликтом по email
    const { data, error } = await supabase
      .from('teachers')
      .upsert(dataToInsert, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        data,
        message: 'Teacher upserted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Upsert teacher error:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 400,
        headers: corsHeaders,
      }
    )
  }
})
