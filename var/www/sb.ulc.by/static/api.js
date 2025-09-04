const API_BASE = 'https://sb.ulc.by/functions/v1'

async function request(endpoint, method = 'POST', data = null) {
  const config = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (data) config.body = JSON.stringify(data)

  const res = await fetch(`${API_BASE}/${endpoint}`, config)
  if (!res.ok) {
    let err
    try {
      err = await res.json()
    } catch {
      err = { error: await res.text() }
    }

    throw new Error(err.error || 'API request failed')
  } else {
    return res.json()
  }
}

const api = {
  // User operations
  getUserByEmail: (email) => request('get-user-by-email', 'POST', { email }),

  getUserByPhone: (phone) => request('get-user-by-phone', 'POST', { phone }),

  upsertUser: (userData) => request('upsert-user', 'POST', userData),

  upsertTeacher: (teacherData) =>
    request('upsert-teacher', 'POST', teacherData),

  updateUserLessonNumber: (userId, lessonNumber) =>
    request('update-user-lesson', 'POST', { userId, lessonNumber }),

  updateLevelProgress: (userId, level, lessonNumber) =>
    request('update-level-progress', 'POST', { userId, level, lessonNumber }),

  // Test operations
  getTestResults: (userId, level, lessonId = null) =>
    request('get-test-results', 'POST', { userId, level, lessonId }),

  saveTestResults: (userId, testId, level, testData) =>
    request('save-test-results', 'POST', { userId, testId, level, testData }),

  saveHomeworkResults: (userId, lessonId, level, homeworkData) =>
    request('save-homework-results', 'POST', {
      userId,
      lessonId,
      level,
      homeworkData,
    }),

  updateLessonLink: (userId, lessonLink) =>
    request('update-lesson-link', 'POST', { userId, lessonLink }),

  getQuestionnaireStatus: (userId) =>
    request('get-questionnaire-status', 'POST', { userId }),

  textToSpeech: (text) =>
    request('text-to-speech', 'POST', {
      text,
      languageCode: 'en-US',
      voiceName: 'en-US-Wavenet-D',
      ssmlGender: 'MALE',
      audioEncoding: 'MP3',
    }),
}
