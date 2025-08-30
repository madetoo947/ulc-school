// /opt/ulc-sb/volumes/functions/questionnaireUser/index.ts

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse the request body
    const formData = await req.json()

    // Validate required fields
    if (!formData.user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare data for Users table update
    const userUpdateData = {
      name: formData.name,
      updated_at: new Date().toISOString(),
      lesson_number: 1, // Устанавливаем lesson_number в 1 как требуется
    }

    // Update Users table
    const { error: userError } = await supabaseClient
      .from('Users')
      .update(userUpdateData)
      .eq('id', formData.user_id)

    if (userError) {
      throw new Error(`Users update error: ${userError.message}`)
    }

    // Prepare data for questionnaire table
    const questionnaireData = {
      user_id: formData.user_id,
      name: formData.name,
      age: formData.age,
      themes: formData.themes,
      learning_purpose: formData.learning_purpose,
      hobby: formData.hobby,
      user_interests: formData.user_interests,
    }

    // Upsert questionnaire data (insert or update if user_id exists)
    const { data: upsertData, error: upsertError } = await supabaseClient
      .from('questionnaire')
      .upsert(questionnaireData, {
        onConflict: 'user_id',
      })
      .select()

    if (upsertError) {
      throw new Error(`Questionnaire upsert error: ${upsertError.message}`)
    }

    return new Response(JSON.stringify(upsertData[0]), {
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
