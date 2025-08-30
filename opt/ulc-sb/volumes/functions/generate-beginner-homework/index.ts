import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'
import { LESSON_PROMPTS } from './LESSON_PROMPTS.ts'

const OPENAI_API_KEY = Deno.env.get('GPT_OPENAI_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GPT_MODEL = Deno.env.get('GPT_MODEL') || 'gpt-3.5-turbo'

const NUMBER_OF_TASKS = '6'

serve(async (req) => {
  // Поддержка CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }
  // Создаем копию запроса для чтения тела
  const reqClone = req.clone()
  let requestData
  try {
    requestData = await reqClone.json()
    const { id, lesson, level } = requestData

    if (!id || !lesson) {
      throw new Error(
        `User ID and lesson are required id: ${id} lesson: ${lesson} level: ${level}`
      )
    }
    // Валидация переменных окружения
    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }
    // Инициализация Supabase клиента
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    // Проверяем существующее домашнее задание
    const { data: existingHomework, error: homeworkError } =
      await supabaseClient
        .from('homework_assignments')
        .select('*')
        .eq('user_id', id)
        .eq('lesson_id', lesson)
        .eq('level', level)
    if (homeworkError) throw homeworkError
    if (existingHomework && existingHomework.length > 0) {
      return new Response(
        JSON.stringify({
          homework: existingHomework[0].homework_data,
          cached: true,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }
    // Получение данных анкеты
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('questionnaire')
      .select('*')
      .eq('user_id', id)
    if (profileError) throw profileError
    if (!userProfile || userProfile.length === 0)
      throw new Error('User profile not found')
    // Формирование промпта
    const prompt = `Ты — дружелюбный преподаватель английского языка. Составь не более ${NUMBER_OF_TASKS} простых заданий. 
Темы урока:
${LESSON_PROMPTS[lesson]}

Условия:
- Все задания — статичные, с вариантами ответов.
- У каждого задания должен быть чёткий правильный ответ.
- Используй темы: ${userProfile[0].themes}.
- Основная цель изучения: ${userProfile[0].learning_purpose}.
- Увлечения: ${userProfile[0].hobby}.
- Интересы: ${userProfile[0].user_interests}.
- Возраст: ${userProfile[0].age} лет.

Формат JSON:
{
  "tasks": [
    {
      "type": "vocabulary" | "grammar" | "dialogue" | "matching",
      "title": "Название",
      "description": "Вопрос",
      "options": ["вариант1", "вариант2", "вариант3"],
      "correct_answer": "правильный вариант"
    }
  ]
}

Только JSON, без пояснений и инструкций.`
    // Запрос к OpenAI
    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: GPT_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Ты преподаватель английского языка.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      }
    )
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`OpenAI API error: ${errorText}`)
    }
    const openaiData = await openaiResponse.json()
    const homeworkContent = openaiData.choices[0]?.message?.content
    // Парсим homework
    const homework = JSON.parse(homeworkContent)
    // Сохраняем в базу данных с использованием upsert
    const { error: insertError } = await supabaseClient
      .from('homework_assignments')
      .upsert(
        {
          user_id: id,
          lesson_id: lesson,
          level: level,
          line_id: `${id}_${level}_${lesson}`,
          homework_data: homework,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'line_id',
        }
      )
    if (insertError) throw insertError
    return new Response(
      JSON.stringify({
        homework,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
