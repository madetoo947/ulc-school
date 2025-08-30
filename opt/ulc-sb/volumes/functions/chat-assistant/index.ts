import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../cors.ts'

const OPENAI_API_KEY = Deno.env.get('ASSISTANT_API_KEY')
const ASSISTANT_ID = Deno.env.get('ASSISTANT_ID')

serve(async (req) => {
  // Поддержка CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, threadId, userId } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Валидация переменных окружения
    if (!OPENAI_API_KEY) {
      throw new Error('Missing required environment variables')
    }

    const headers = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    }

    // Создаем или используем существующий thread
    let currentThreadId = threadId
    if (!currentThreadId) {
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
      })

      if (!threadResponse.ok) {
        throw new Error(
          `Failed to create thread: ${await threadResponse.text()}`
        )
      }

      const threadData = await threadResponse.json()
      currentThreadId = threadData.id
    }

    // Отправляем сообщение пользователя
    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: 'user',
          content: message,
        }),
      }
    )

    if (!messageResponse.ok) {
      throw new Error(`Failed to send message: ${await messageResponse.text()}`)
    }

    // Запускаем ассистента
    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assistant_id: ASSISTANT_ID,
        }),
      }
    )

    if (!runResponse.ok) {
      throw new Error(`Failed to start run: ${await runResponse.text()}`)
    }

    const runData = await runResponse.json()
    const runId = runData.id

    // Ждем завершения выполнения
    let status = ''
    let attempts = 0
    const maxAttempts = 30
    const delay = 1000

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delay))

      const statusResponse = await fetch(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
        { headers }
      )

      if (!statusResponse.ok) {
        throw new Error(
          `Failed to check status: ${await statusResponse.text()}`
        )
      }

      const statusData = await statusResponse.json()
      status = statusData.status

      if (
        status === 'completed' ||
        status === 'failed' ||
        status === 'cancelled'
      ) {
        break
      }

      attempts++
    }

    if (status !== 'completed') {
      throw new Error(`Run did not complete successfully. Status: ${status}`)
    }

    // Получаем ответ ассистента
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages?order=desc&limit=1`,
      { headers }
    )

    if (!messagesResponse.ok) {
      throw new Error(
        `Failed to get messages: ${await messagesResponse.text()}`
      )
    }

    const messagesData = await messagesResponse.json()
    const assistantMessage = messagesData.data[0]
    const reply =
      assistantMessage.content[0]?.text?.value || 'Ответ не получен.'

    return new Response(
      JSON.stringify({
        reply,
        threadId: currentThreadId,
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
