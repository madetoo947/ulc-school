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
    const { userId, testId, level, testData } = await req.json()

    // Calculate score
    const correctAnswers = Object.values(testData).filter(
      (q) => q.isCorrect
    ).length
    const totalQuestions = Object.keys(testData).length
    const score = Math.round((correctAnswers / totalQuestions) * 100)
    const isPassed = score >= 70

    // Upsert operation with conflict resolution on test_id
    const { data, error } = await supabase
      .from(`${level}TestResults`)
      .upsert(
        {
          test_id: `${userId}_${testId}`,
          user_id: userId,
          test_data: testData,
          score,
          is_passed: isPassed,
          completed_at: new Date().toISOString(),
        },
        {
          onConflict: 'test_id', // Specify the conflict target
          ignoreDuplicates: false, // Perform update on conflict
        }
      )
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        data,
        score,
        isPassed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Save test results error:', err)
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
