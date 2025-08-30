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
    const { userId, level, lessonNumber } = await req.json()

    if (!userId || !level || lessonNumber === undefined) {
      throw new Error('userId, level and lessonNumber are required')
    }

    // Получаем текущие данные пользователя
    const { data: user, error: fetchError } = await supabase
      .from('Users')
      .select('level_progress')
      .eq('id', userId)
      .single()

    if (fetchError) throw fetchError

    // Обновляем прогресс для конкретного уровня
    const updatedProgress = {
      ...user.level_progress,
      [level]: Math.max(lessonNumber, user.level_progress?.[level] || 0),
    }

    // Обновляем запись
    const { data, error } = await supabase
      .from('Users')
      .update({
        level_progress: updatedProgress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        data,
        message: 'Level progress updated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Update level progress error:', err)
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
