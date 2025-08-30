import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders })
//   }

//   try {
//     const userData = await req.json()

//     // Валидация обязательных полей
//     if (!userData.email) {
//       throw new Error('Email is required')
//     }

//     // Подготавливаем данные для вставки
//     const dataToInsert = {
//       name: userData.name || null,
//       phone: userData.phone || null,
//       email: userData.email,
//       lesson_number: userData.lesson_number || 1,
//       role: userData.role || null,
//       lesson_link: userData.lesson_link || null,
//       updated_at: new Date().toISOString(),
//     }

//     // Upsert операция с конфликтом по email
//     const { data, error } = await supabase
//       .from('Users')
//       .upsert(dataToInsert, {
//         onConflict: 'email',
//         ignoreDuplicates: false,
//       })
//       .select()
//       .single()

//     if (error) throw error

//     return new Response(
//       JSON.stringify({
//         success: true,
//         data,
//         message: 'User upserted successfully',
//       }),
//       {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
//       }
//     )
//   } catch (err) {
//     console.error('Upsert user error:', err)
//     return new Response(
//       JSON.stringify({
//         success: false,
//         error: err.message,
//       }),
//       {
//         status: 400,
//         headers: corsHeaders,
//       }
//     )
//   }
// })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userData = await req.json()

    // Валидация обязательных полей
    if (!userData.email) {
      throw new Error('Email is required')
    }

    // Подготавливаем данные для вставки
    const dataToInsert = {
      name: userData.name || null,
      phone: userData.phone || null,
      email: userData.email,
      lesson_number: userData.lesson_number || 1,
      level_progress: userData.level_progress || { beginner: 0, elementary: 0 },
      role: userData.role || null,
      lesson_link: userData.lesson_link || null,
      updated_at: new Date().toISOString(),
    }

    // Upsert операция с конфликтом по email
    const { data, error } = await supabase
      .from('Users')
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
        message: 'User upserted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Upsert user error:', err)
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
