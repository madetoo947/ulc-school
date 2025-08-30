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
    const { email } = await req.json()
    const auth = toBase64Utf8(
      `${Deno.env.get('API_1C_USER')}:${Deno.env.get('API_1C_PASS')}`
    )

    // Сначала проверяем, является ли пользователь преподавателем
    const teacherCheck = await fetch(
      `${API_1C_BASE_URL}/employee_by_email?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!teacherCheck.ok) {
      return new Response(
        JSON.stringify({ result: false, error: 'Преподаватель не найден' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const teacherData = await teacherCheck.json()

    // Затем получаем список студентов преподавателя
    const studentsRes = await fetch(
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

    let students = []
    if (studentsRes.ok) {
      const studentsData = await studentsRes.json()
      students = studentsData.students || []
    }

    return new Response(
      JSON.stringify({
        result: true,
        teacher: teacherData,
        students,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
