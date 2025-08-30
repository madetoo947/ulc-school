import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, lessonId, level, homeworkData } = await req.json()

    // Преобразуем данные для удобства анализа
    const transformedData = {
      lesson: lessonId,
      level: level,
      tasks: homeworkData.tasks.map((task: any, index: number) => {
        const userAnswer = homeworkData.userAnswers[index]
        const isCorrect = task.correct_answer === task.options[userAnswer]

        return {
          type: task.type,
          title: task.title,
          description: task.description,
          options: task.options,
          correct_answer: task.correct_answer,
          user_answer: task.options[userAnswer],
          is_correct: isCorrect,
          answer_index: userAnswer,
        }
      }),
      stats: {
        total_questions: homeworkData.tasks.length,
        correct_answers: homeworkData.tasks.filter(
          (task: any, index: number) => {
            return (
              task.correct_answer ===
              task.options[homeworkData.userAnswers[index]]
            )
          }
        ).length,
        score: Math.round(
          (homeworkData.tasks.filter((task: any, index: number) => {
            return (
              task.correct_answer ===
              task.options[homeworkData.userAnswers[index]]
            )
          }).length /
            homeworkData.tasks.length) *
            100
        ),
        completed_at: homeworkData.completedAt || new Date().toISOString(),
      },
    }

    // Создаем ID в формате "userid_lesson-homework"
    const testId = `${userId}_${lessonId}-homework`

    // Сохраняем в базу
    const { data, error } = await supabase
      .from(`${level}TestResults`)
      .upsert(
        {
          test_id: testId,
          user_id: userId,
          test_data: transformedData,
          score: transformedData.stats.score,
          is_passed: transformedData.stats.score >= 70,
          completed_at: transformedData.stats.completed_at,
        },
        {
          onConflict: 'test_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        data: transformedData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Ошибка сохранения ДЗ:', err)
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
