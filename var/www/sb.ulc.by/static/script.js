let db
const DB_NAME = 'AudioCacheDB'
const STORE_NAME = 'audioStore'
const DB_VERSION = 1
let userData = null
const testBlocks = {}
let currentAudio = null
const playIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20C4.47699 20 0 15.523 0 10C0 4.47699 4.47699 0 10 0C15.523 0 20 4.47699 20 10C20 15.523 15.523 20 10 20ZM10 1.08786C5.1046 1.08786 1.08787 5.1046 1.08787 10C1.08787 14.8954 5.1046 18.9121 10 18.9121C14.8954 18.9121 18.9121 14.8954 18.9121 10C18.9121 5.06276 14.8954 1.08786 10 1.08786Z" fill="#CC1E1D"/><path d="M7.02921 15.1464V4.81172L15.8995 10L7.02921 15.1464ZM8.20076 6.86192V13.0962L13.5146 10L8.20076 6.86192Z" fill="#CC1E1D"/></svg>`
const pauseIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.0002 0C15.5232 8.79787e-05 20 4.47722 20 10.0002C19.9999 15.5231 15.5231 19.9999 10.0002 20C4.47722 20 8.97095e-05 15.5232 0 10.0002C0 4.47717 4.47717 0 10.0002 0ZM10.0002 1.08771C5.10479 1.08771 1.08771 5.10479 1.08771 10.0002C1.0878 14.8955 5.10484 18.9123 10.0002 18.9123C14.8955 18.9122 18.9122 14.8955 18.9123 10.0002C18.9123 5.063 14.8955 1.0878 10.0002 1.08771Z" fill="#CC1E1D"/><path d="M7.113 5.02094H8.36824V15.0628H7.113V5.02094Z" fill="#CC1E1D"/><path d="M11.7155 5.02094H12.9708V15.0628H11.7155V5.02094Z" fill="#CC1E1D"/></svg>`

const LESSON_STRUCTURE = {
  beginner: [
    '1A',
    '1B',
    '2A',
    '2B',
    '3A',
    '3B',
    '4A',
    '4B',
    '5A',
    '5B',
    '6A',
    '6B',
    'Part1',
    '7A',
    '7B',
    '8A',
    '8B',
    '9A',
    '9B',
    '10A',
    '10B',
    '11A',
    '11B',
    '12A',
    '12B',
    'Part2',
  ],
  elementary: [
    '1A',
    '1B',
    '1C',
    '2A',
    '2B',
    '2C',
    '3A',
    '3B',
    '3C',
    '4A',
    '4B',
    '4C',
    '5A',
    '5B',
    '5C',
    '6A',
    '6B',
    '6C',
    '7A',
    '7B',
    '7C',
    '8A',
    '8B',
    '8C',
    '9A',
    '9B',
    '10A',
    '10B',
    '10C',
    '11A',
    '11B',
    '11C',
    '12A',
    '12B',
    '12C',
  ],
}
function getCurrentLessonStructure() {
  const level = getCurrentLevelFromUrl()
  return LESSON_STRUCTURE[level] || LESSON_STRUCTURE.beginner
}
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = (event) => {
      console.error('Ошибка при открытии IndexedDB:', event.target.error)
      reject(event.target.error)
    }

    request.onsuccess = (event) => {
      db = event.target.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'text' })
      }
    }
  })
}
function saveAudioToDB(text, audioContent) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.put({ text, audioContent })
    request.onsuccess = () => resolve()
    request.onerror = (event) => {
      console.error('Ошибка при сохранении аудио:', event.target.error)
      reject(event.target.error)
    }
  })
}
function getAudioFromDB(text) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.get(text)

    request.onsuccess = () => {
      resolve(request.result?.audioContent || null)
    }

    request.onerror = (event) => {
      console.error('Ошибка при получении аудио:', event.target.error)
      reject(event.target.error)
    }
  })
}
async function speak(text, buttonElement) {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause()
    buttonElement.innerHTML = playIcon
    return
  }

  try {
    buttonElement.innerHTML = pauseIcon

    if (currentAudio && currentAudio.paused) {
      currentAudio.play()
      return
    }

    if (!db) {
      await initDB()
    }

    // Check cache first
    const cachedAudio = await getAudioFromDB(text)

    if (cachedAudio) {
      console.log('Using cached audio')
      if (currentAudio) {
        currentAudio.removeEventListener('ended', onAudioEnd)
      }

      currentAudio = new Audio('data:audio/mp3;base64,' + cachedAudio)
      currentAudio.addEventListener('ended', function onAudioEnd() {
        buttonElement.innerHTML = playIcon
        currentAudio = null
      })
      currentAudio.play()
    } else {
      console.log('Requesting TTS from Edge Function')

      // Use the API module to call the Edge Function
      const data = await api.textToSpeech(text)

      if (data.audioContent) {
        // Save to cache
        await saveAudioToDB(text, data.audioContent)

        // Play the audio
        if (currentAudio) {
          currentAudio.removeEventListener('ended', onAudioEnd)
        }

        currentAudio = new Audio('data:audio/mp3;base64,' + data.audioContent)
        currentAudio.addEventListener('ended', function onAudioEnd() {
          buttonElement.innerHTML = playIcon
          currentAudio = null
        })

        currentAudio.play()
      } else if (data.error) {
        console.error('TTS Error:', data.error)
        buttonElement.innerHTML = playIcon
        throw new Error(data.error)
      } else {
        console.error('Invalid TTS response:', data)
        buttonElement.innerHTML = playIcon
        throw new Error('Invalid TTS response')
      }
    }
  } catch (error) {
    console.error('Error in speak function:', error)
    buttonElement.innerHTML = playIcon

    // Show error to user if needed
    if (error.message.includes('Текст не указан')) {
      alert('Please provide text to speak')
    } else if (error.message.includes('Ошибка синтеза речи')) {
      alert('Speech synthesis error. Please try again.')
    }
  }
}
// ========== Вспомогательные function ==========
function generateUniqueId(testId, index) {
  return `${testId.replace(/^uc-/, '')}-question-${index + 1}`
}
function calculateTestScore(testData) {
  let correctAnswers = 0
  let totalQuestions = 0

  for (const key in testData) {
    if (testData[key].isCorrect) correctAnswers++
    totalQuestions++
  }

  const score =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
  return score
}
function isTestPassed(testData) {
  const score = calculateTestScore(testData)
  const passed = score >= 70
  return passed
}
function formatPart(str) {
  return str.replace('part-', 'Part')
}
function getCurrentLessonFromUrl() {
  const url = window.location.pathname
  const regularMatch = url.match(/\/(\d+[a-zA-Z])$/)
  if (regularMatch) return regularMatch[1].toUpperCase()
  const progressMatch = url.match(/\/progress-test-(part-\d+)$/)
  if (progressMatch) return formatPart(progressMatch[1].replace('-', '-'))
  return null
}

function getCurrentLessonProgress() {
  const currentLevel = getCurrentLevelFromUrl()

  // Всегда используем level_progress
  if (
    userData.level_progress &&
    userData.level_progress[currentLevel] !== undefined
  ) {
    return userData.level_progress[currentLevel]
  } else {
    // Для старых пользователей создаем level_progress на основе lesson_number
    if (!userData.level_progress) {
      userData.level_progress = {
        beginner: userData.lesson_number || 0,
        elementary: 0,
      }
    }
    return userData.level_progress[currentLevel] || 0
  }
}

// Обновляем прогресс для активного уровня
async function updateLessonProgress(newLessonNumber) {
  const currentLevel = getCurrentLevelFromUrl()

  try {
    // Обновляем только текущий уровень в level_progress
    const updatedProgress = {
      ...userData.level_progress,
      [currentLevel]: newLessonNumber,
    }

    await api.updateLevelProgress(userData.id, currentLevel, newLessonNumber)

    // Обновляем локальные данные
    userData.level_progress = updatedProgress

    console.log(`Progress updated for ${currentLevel}:`, newLessonNumber)
  } catch (error) {
    console.error('Error updating lesson progress:', error)
    throw error
  }
}

// ========== Функции работы с Supabase ==========
function getCurrentLevelFromUrl() {
  const url = window.location.pathname

  // Вариант 1: Более гибкое регулярное выражение
  const levelMatch = url.match(/\/lk\/([a-zA-Z]+)(?:\/|$)/)

  // Вариант 2: Простая проверка по сегментам пути
  const pathSegments = url.split('/').filter((segment) => segment)

  if (pathSegments.length >= 2 && pathSegments[0] === 'lk') {
    return pathSegments[1].toLowerCase()
  }

  return levelMatch ? levelMatch[1].toLowerCase() : 'beginner'
}
async function getUserByEmail(email) {
  try {
    return await api.getUserByEmail(email)
  } catch (error) {
    console.error('Error getting user:', error)
    throw error
  }
}
async function updateUserLessonNumber(userId, newLessonNumber) {
  try {
    return await api.updateUserLessonNumber(userId, newLessonNumber)
  } catch (error) {
    console.error('Error updating lesson number:', error)
    throw error
  }
}
async function checkAllTestsCompleted(testId) {
  try {
    const allTestsCompleted = Object.values(testBlocks).every((block) => {
      return block.answeredQuestions === block.totalQuestions
    })
    if (allTestsCompleted) {
      // Разблокируем домашнее задание
      unlockHomework()

      // Показываем сообщение о доступности домашнего задания
      showHomeworkUnlockedMessage()
    }
  } catch (error) {
    console.error('Ошибка при проверке завершения тестов:', error)
  }
}

function unlockHomework() {
  // Сохраняем в localStorage что тесты пройдены
  const currentLesson = getCurrentLessonFromUrl()
  const currentLevel = getCurrentLevelFromUrl()
  const key = `tests_completed_${currentLevel}_${currentLesson}`
  localStorage.setItem(key, 'true')

  // Уведомляем homework.js о разблокировке
  if (window.homeworkUnlocked) {
    window.homeworkUnlocked()
  }
}

function showHomeworkUnlockedMessage() {
  const message = document.createElement('div')
  message.className = 'homework-unlocked-message'
  message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #4CAF50;
    color: white;
    padding: 20px 30px;
    border-radius: 10px;
    z-index: 10000;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `
  message.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">🎉 Поздравляем!</h3>
    <p style="margin: 0 0 15px 0;">Все тесты пройдены! Теперь доступно домашнее задание.</p>
    <button onclick="this.parentElement.remove()" style="
      background: white;
      color: #4CAF50;
      border: none;
      padding: 8px 16px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    ">OK</button>
  `
  document.body.appendChild(message)

  // Автоматически убираем через 5 секунд
  setTimeout(() => {
    if (message.parentElement) {
      message.remove()
    }
  }, 5000)
}

// Функция для обработки завершения домашнего задания
async function onHomeworkCompleted() {
  try {
    const currentLevel = getCurrentLevelFromUrl()
    const currentLesson = getCurrentLessonFromUrl()
    if (!currentLesson) return

    const lessonOrder = LESSON_STRUCTURE[currentLevel]
    const currentIndex = lessonOrder.findIndex(
      (item) => item.toLowerCase() === currentLesson.toLowerCase()
    )

    if (currentIndex === -1) return

    const currentProgress = getCurrentLessonProgress()

    // Обновляем прогресс только если текущий урок еще не пройден
    if (currentIndex >= currentProgress) {
      const newLessonNumber = currentIndex + 1
      await updateLessonProgress(newLessonNumber)

      // Показываем сообщение о завершении
      if (currentIndex === lessonOrder.length - 1) {
        showCompletionMessage('lastLesson')
      } else {
        const nextLesson = lessonOrder[currentIndex + 1]
        showCompletionMessage(nextLesson)
      }

      updateLessonButtons()
    }
  } catch (error) {
    console.error('Ошибка при обработке завершения домашнего задания:', error)
  }
}

function showCompletionMessage(nextLesson) {
  const currentLevel = getCurrentLevelFromUrl()
  const completionMessage = document.createElement('div')
  completionMessage.className = 'lesson-completion-message'
  if (nextLesson.includes('Part1')) {
    nextLesson = 'progress-test-part-1'
  }
  if (nextLesson.includes('Part2')) {
    nextLesson = 'progress-test-part-2'
  }

  if (nextLesson === 'lastLesson') {
    completionMessage.innerHTML = `
        <h3 style="">Поздравляем!</h3> 
        <p>Вы успешно завершили все тесты этого урока.</p> 
        <p>Это последний тест курса</p
        <div class="btn-container-completion-message">
        <a id="close-completion-message">OK</a>
        <a id="next-lesson-completion-message" href="/lk/${currentLevel}">В личный кабинет</a>
        </div>

    `
  } else {
    completionMessage.innerHTML = `
        <h3 style="">Поздравляем!</h3> 
        <p>Вы успешно завершили все тесты этого урока.</p> 
        <p>Теперь вам доступен следующий урок: ${nextLesson}</p
        <div class="btn-container-completion-message">
        <a id="close-completion-message">OK</a>
        <a id="next-lesson-completion-message" href="/lk/${currentLevel}/${nextLesson.toLowerCase()}">Следующий урок</a>
        </div>

    `
  }
  document.body.style.overflow = 'hidden'
  document.body.style.touchAction = 'none'
  document.body.appendChild(completionMessage)
  document
    .getElementById('close-completion-message')
    .addEventListener('click', () => {
      document.body.style.overflow = 'auto'
      document.body.style.touchAction = 'auto'
      document.body.removeChild(completionMessage)
    })
}
async function getUserTestResults(userId, lessonId = null, level = null) {
  try {
    const currentLevel = level || getCurrentLevelFromUrl()
    return await api.getTestResults(userId, currentLevel, lessonId)
  } catch (error) {
    console.error('Error getting test results:', error)
    return []
  }
}
async function saveTestResults(testId, level = null) {
  const currentLevel = level || getCurrentLevelFromUrl()
  const testBlock = testBlocks[testId]

  if (!testBlock) {
    throw new Error('Test block not found')
  }

  try {
    // Получаем текущий URL и якорь блока теста
    const currentUrl = window.location.href
    const testElement = document.querySelector(`.${testId}`)
    const anchorId = testElement ? testElement.id : null
    const pageUrl = anchorId
      ? `${currentUrl.split('#')[0]}#${anchorId}`
      : currentUrl

    // Добавляем информацию о странице и якоре в данные теста
    const testDataWithUrl = {
      ...testBlock.testData,
      _meta: {
        pageUrl: pageUrl,
        testId: testId,
        completedAt: new Date().toISOString(),
      },
    }
    const result = await api.saveTestResults(
      userData.id,
      testId,
      currentLevel,
      // testBlock.testData
      testDataWithUrl
    )

    disableTestInputs(testId)
    await checkAllTestsCompleted(testId)
    return result
  } catch (error) {
    console.error('Error saving test results:', error)
    const tildaUser = getTildaUserData()
    saveToLocalStorageAsFallback(testId, tildaUser, testBlock)
    throw error
  }
}
function disableTestInputs(testId) {
  const testElement = document.querySelector(`.${testId}`)
  if (testElement) {
    const inputs = testElement.querySelectorAll('.test-input')
    inputs.forEach((input) => {
      input.style.pointerEvents = 'none'
    })
  }
}
function saveToLocalStorageAsFallback(testId, tildaUser, testBlock) {
  try {
    const savedTests = JSON.parse(localStorage.getItem('savedTests') || '{}')
    savedTests[testId] = {
      test_id: testId,
      user_email: tildaUser.data.login,
      answers: testBlock.testData,
      score: calculateTestScore(testBlock.testData),
      is_passed: isTestPassed(testBlock.testData),
    }
    localStorage.setItem('savedTests', JSON.stringify(savedTests))
    console.warn('Results saved to localStorage as fallback')
  } catch (localStorageError) {
    console.error('Failed to save to localStorage:', localStorageError)
  }
}
function getTildaUserData() {
  if (
    window.tilda_ma &&
    window.tilda_ma.profile &&
    window.tilda_ma.profile.login
  ) {
    return {
      key: 'tilda_ma_profile',
      data: {
        login: window.tilda_ma.profile.login,
      },
    }
  }
  // Fallback на старый метод, если tilda_ma недоступен
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('tilda_members_profile')) {
      try {
        const userData = JSON.parse(localStorage.getItem(key))
        if (userData && userData.login) {
          console.warn('Using localStorage as a fallback for user data.')
          return { key, data: userData }
        }
      } catch (e) {
        console.error('Ошибка парсинга данных пользователя:', e)
      }
    }
  }
  return null
}

async function initUser() {
  try {
    const tildaUser = getTildaUserData()
    if (!tildaUser || !tildaUser.data.login) {
      throw new Error('Не удалось получить данные пользователя из Tilda')
    }

    userData = await getUserByEmail(tildaUser.data.login)
    if (!userData) {
      throw new Error('Пользователь не найден в базе данных')
    }

    // Гарантируем, что level_progress существует
    if (!userData.level_progress) {
      userData.level_progress = {
        beginner: userData.lesson_number || 0,
        elementary: 0,
      }
    }

    const currentLevel = getCurrentLevelFromUrl()
    const currentLesson = getCurrentLessonFromUrl()

    if (currentLesson) {
      const lessonOrder = LESSON_STRUCTURE[currentLevel]
      if (!lessonOrder) {
        throw new Error(`Unknown level: ${currentLevel}`)
      }

      const currentLessonIndex = lessonOrder.findIndex(
        (item) => item.toLowerCase() === currentLesson.toLowerCase()
      )

      if (currentLessonIndex === -1) {
        throw new Error(`Unknown lesson: ${currentLesson}`)
      }

      // Получаем текущий прогресс для этого уровня из level_progress
      const currentProgress = getCurrentLessonProgress()

      if (currentLessonIndex > currentProgress) {
        hideLoad()
        showLessonAccessDenied(currentLesson, currentLevel)
        throw new Error('Lesson Access Denied')
      }
    }

    updateLessonButtons()
    if (typeof renderLevelCards === 'function') {
      renderLevelCards()
    }
    hideLoad()
  } catch (error) {
    console.error('Ошибка инициализации пользователя:', error)
    showErrorMessage('Ошибка загрузки данных. Пожалуйста, обновите страницу.')
  }
}

function showLessonAccessDenied(lesson, level) {
  const accessDeniedMessage = document.createElement('div')
  accessDeniedMessage.className = 'lesson-access-denied'
  accessDeniedMessage.innerHTML = `
        <div>
        <h3>Доступ ограничен</h3> 
         <p>Урок ${lesson} пока недоступен.</p> 
         <p>Пожалуйста, завершите предыдущие уроки для получения доступа.</p> 
         <button id="close-access-denied">Вернуться в личный кабинет</button>
   </div>
    `
  document.body.appendChild(accessDeniedMessage)
  document
    .getElementById('close-access-denied')
    .addEventListener('click', () => {
      window.location.href = `/lk/${level}`
    })
  document.body.style.overflow = 'hidden'
  document.body.style.touchAction = 'none'
}
function updateLessonButtons() {
  const currentLevel = getCurrentLevelFromUrl()
  const lessonOrder = getCurrentLessonStructure()
  const currentProgress = getCurrentLessonProgress() // Используем level_progress

  document.querySelectorAll('[class*="button-lesson-"]').forEach((button) => {
    const match = button.className.match(/button-lesson-([\w-]+)/)
    if (!match) return

    let lessonId = match[1]
    const lessonIndex = lessonOrder.findIndex(
      (item) => item.toLowerCase() === lessonId.toLowerCase()
    )
    console.log(lessonIndex, lessonId)
    if (lessonIndex !== -1) {
      const tnAtom = button.querySelector('.tn-atom')
      if (tnAtom) {
        if (lessonIndex <= currentProgress) {
          tnAtom.classList.add('active')
          tnAtom.style.cursor = 'pointer'
          // Убедимся, что ссылка установлена
          if (!tnAtom.getAttribute('href')) {
            tnAtom.setAttribute(
              'href',
              `/lk/${currentLevel}/${lessonId.toLowerCase()}`
            )
          }
        } else {
          tnAtom.classList.remove('active')
          tnAtom.removeAttribute('href')
          tnAtom.style.cursor = 'not-allowed'
        }
      }
    } else {
      console.warn('Lesson ID not found in order:', lessonId)
    }
  })
}
function showErrorMessage(message) {
  const errorElements = document.querySelectorAll('.error-message')
  errorElements.forEach((element) => {
    element.textContent = message
    element.style.display = 'block'
  })
}
function hideLoad() {
  const loader = document.querySelector('.cs-loader').closest('.t-rec')
  loader.style.display = 'none'
  document.body.style.overflow = 'auto'
  document.body.style.touchAction = 'auto'
}
function showLoad() {
  const loader = document.querySelector('.cs-loader').closest('.t-rec')
  loader.style.display = 'block'
  document.body.style.overflow = 'hidden'
  document.body.style.touchAction = 'none'
}
// ========== Функции работы с тестами ==========
function createTestResultsSummary(testResults) {
  const summaryContainer = document.createElement('div')
  summaryContainer.className = 'test-results-summary'
  const title = document.createElement('h2')
  title.style.cssText = 'margin-top: 0; color: #333;'
  title.textContent = 'Результаты тестов'
  summaryContainer.appendChild(title)
  if (testResults.length === 0) {
    summaryContainer.style.display = 'none'
    return summaryContainer
  }
  const groupedResults = groupAndSortTestResults(testResults)
  const table = document.createElement('table')
  table.style.cssText = 'width: 100%; border-collapse: collapse;'
  const thead = document.createElement('thead')
  thead.innerHTML = `
        <tr style="border-bottom: 1px solid #dee2e6;">
            <th style="padding: 10px; text-align: left;">Тест</th>
            <th style="padding: 10px; text-align: center;">Результат</th>
            <th style="padding: 10px; text-align: center;">Статус</th>
            <th style="padding: 10px; text-align: right;">Дата прохождения</th>
        </tr>
    `
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  groupedResults.forEach(({ testName, latestResult }) => {
    const date = new Date(latestResult.completed_at)
    const formattedDate = date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const row = document.createElement('tr')
    row.style.borderBottom = '1px solid #dee2e6'
    row.innerHTML = `
            <td style="padding: 10px;">${testName}</td>
            <td style="padding: 10px; text-align: center; font-weight: bold; color: ${
              latestResult.is_passed ? '#28a745' : '#dc3545'
            }">
                ${latestResult.score}%
            </td>
            <td style="padding: 10px; text-align: center;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; 
                    background: ${
                      latestResult.is_passed ? '#e8f5e9' : '#ffebee'
                    }; 
                    color: ${latestResult.is_passed ? '#28a745' : '#dc3545'}; 
                    font-weight: bold;">
                    ${latestResult.is_passed ? 'Пройден' : 'Не пройден'}
                </span>
            </td>
            <td style="padding: 10px; text-align: right;">${formattedDate}</td>
        `
    tbody.appendChild(row)
  })
  table.appendChild(tbody)
  summaryContainer.appendChild(table)
  return summaryContainer
}
function groupAndSortTestResults(testResults) {
  const groupedResults = {}
  testResults.forEach((result) => {
    const testType = result.test_type || result.test_id.split('_').pop()
    if (!groupedResults[testType]) {
      groupedResults[testType] = []
    }
    groupedResults[testType].push(result)
  })
  return Object.entries(groupedResults)
    .map(([testType, results]) => {
      let testName = testType
      if (testType.startsWith('uc-')) {
        testName = testType.substring(3).replace('-', ' ')
      } else if (testType.includes('-Test')) {
        testName = testType.replace('-Test', ' Test')
      }
      results.sort(
        (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
      )

      return {
        testType,
        testName,
        latestResult: results[0],
      }
    })
    .sort((a, b) => {
      const numA = parseInt(a.testName.match(/Test(\d+)/)?.[1] || 0)
      const numB = parseInt(b.testName.match(/Test(\d+)/)?.[1] || 0)
      const mainPartA = a.testName.split('Test')[0]
      const mainPartB = b.testName.split('Test')[0]

      if (mainPartA < mainPartB) return -1
      if (mainPartA > mainPartB) return 1
      return numA - numB
    })
}
async function initTestPage() {
  try {
    const tildaUser = getTildaUserData()
    if (!tildaUser || !tildaUser.data.login) {
      throw new Error('Не удалось получить данные пользователя из Tilda')
    }
    userData = await getUserByEmail(tildaUser.data.login)
    if (!userData) {
      throw new Error('Пользователь не найден в базе данных')
    }
    const testResults = await getUserTestResults(
      userData.id,
      getCurrentLessonFromUrl()
    )
    const summary = createTestResultsSummary(testResults)
    const testContainer = document.querySelector('[class*="uc-test"]')
    if (testContainer) {
      testContainer.prepend(summary)
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы тестов:', error)
  } finally {
    initTestBlocks()
  }
}
function initTestBlocks() {
  const testElements = document.querySelectorAll(
    '[class*="uc-"][class*="-Test"]'
  )
  testElements.forEach((element) => {
    const testClass = Array.from(element.classList).find(
      (c) => c.startsWith('uc-') && c.includes('-Test')
    )

    const testId = testClass

    if (!testId) {
      console.error('ID теста не найден для элемента:', element)
      return
    }

    testBlocks[testId] = {
      element: element,
      totalQuestions: 0,
      answeredQuestions: 0,
      testData: {},
      resultsContainer: document.createElement('div'),
    }

    testBlocks[testId].resultsContainer.className = 'test-results'
    testBlocks[testId].resultsContainer.style.cssText =
      'margin-top:20px;padding:15px;border-radius:5px;display:none;'
    element.appendChild(testBlocks[testId].resultsContainer)
    initTestBlock(testId)
  })
}
function initTestBlock(testId) {
  const testBlock = testBlocks[testId]
  const testElement = testBlock.element

  if (testElement.querySelector('.test-input')) {
    initInputTest(testId)
  } else if (testElement.querySelector('#sortable-list')) {
    initSortableTest(testId)
  } else if (
    testElement.querySelector(
      '.test-radio, input[type="radio"], input[type="checkbox"]'
    )
  ) {
    initRadioCheckboxTest(testId)
  } else {
    console.warn('Тип теста не определен для блока:', testId)
  }
}
function showTestResults(testId) {
  const testBlock = testBlocks[testId]
  const testData = testBlock.testData
  const score = calculateTestScore(testData)
  const isPassed = isTestPassed(testData)
  const summaryHTML = `
        <h3 style="margin-top: 0; color: #333;">Результаты теста</h3>
        <div class="test-summary" style="margin-bottom: 15px;">
            <p style="margin: 5px 0;">
                <span style="font-weight: bold;">Ваш результат:</span> 
                <span style="font-weight: bold; color: ${
                  isPassed ? '#28a745' : '#dc3545'
                }">${score}%</span>
            </p>
            <p style="margin: 5px 0;">
                <span style="font-weight: bold;">Статус:</span> 
                <span style="font-weight: bold; color: ${
                  isPassed ? '#28a745' : '#dc3545'
                }">
                    ${isPassed ? 'ТЕСТ ПРОЙДЕН' : 'ТЕСТ НЕ ПРОЙДЕН'}
                </span>
            </p>
        </div>
        <div class="questions-results" style="border-top: 1px solid #eee; padding-top: 15px;">
    `

  let questionsHTML = ''
  let questionNumber = 1

  // Для тестов сортировки собираем все элементы с data-question-id
  const questionElements = Array.from(
    testBlock.element.querySelectorAll('[data-question-id]')
  )
  const sortedQuestions = questionElements
    .map((el) => {
      const questionId = el.dataset.questionId
      return {
        id: questionId,
        data: testData[questionId],
        element: el,
      }
    })
    .filter((q) => q.data)

  sortedQuestions.forEach(({ id, data, element }) => {
    const isCorrect = data.isCorrect
    let userAnswerFormatted = Array.isArray(data.userAnswers)
      ? data.userAnswers.join(', ')
      : data.userAnswer || '—'

    let correctAnswerFormatted = Array.isArray(data.correctAnswers)
      ? data.correctAnswers.join(', ')
      : data.correctAnswer || '—'

    questionsHTML += `
            <div class="question-result" style="margin-bottom: 10px; padding: 10px; 
                background-color: ${isCorrect ? '#e8f5e9' : '#ffebee'}; 
                border-left: 4px solid ${isCorrect ? '#28a745' : '#dc3545'};">
                <div class="question-status" style="font-weight: bold;">
                    ${isCorrect ? '✓' : '✗'} Вопрос ${questionNumber++}
                </div>
                <div style="margin-top: 5px;">
                    <span style="font-weight: bold;">Ваш ответ:</span> ${
                      userAnswerFormatted || '—'
                    }
                </div>
        `

    if (!isCorrect && correctAnswerFormatted !== '—') {
      questionsHTML += `
                <div style="margin-top: 5px; color: #28a745;">
                    <span style="font-weight: bold;">Правильный ответ:</span> ${correctAnswerFormatted}
                </div>
            `
    }

    questionsHTML += `</div>`
  })

  const fullHTML = summaryHTML + questionsHTML + `</div>`
  const testElement = testBlock.element
  let resultsContainer = testElement.nextElementSibling

  if (
    resultsContainer &&
    resultsContainer.classList.contains('test-results-container')
  ) {
    resultsContainer.innerHTML = fullHTML
  } else {
    resultsContainer = document.createElement('div')
    resultsContainer.className = 'test-results-container'
    resultsContainer.innerHTML = fullHTML
    testElement.insertAdjacentElement('afterend', resultsContainer)
  }

  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
function initInputTest(testId) {
  const testBlock = testBlocks[testId]
  const testElement = testBlock.element
  const testInputs = testElement.querySelectorAll('.test-input')
  testBlock.testData = {}
  testBlock.totalQuestions = 0
  testBlock.answeredQuestions = 0
  const questions = []
  testInputs.forEach((inputContainer, containerIndex) => {
    const tnAtom = inputContainer.querySelector('.tn-atom')
    if (!tnAtom) return

    testBlock.totalQuestions++
    const questionId = generateUniqueId(testId, containerIndex)
    tnAtom.dataset.questionId = questionId
    const strongTags = Array.from(tnAtom.querySelectorAll('strong'))

    const inputFields = []
    let isQuestionComplete = false

    strongTags.forEach((strongTag, index) => {
      const correctAnswers = strongTag.textContent
        .split(',')
        .map((answer) => answer.trim())
        .filter((answer) => answer.length > 0)

      const input = document.createElement('input')
      input.type = 'text'
      input.dataset.inputIndex = index
      input.dataset.correctAnswers = correctAnswers.join(', ')
      input.style.cssText = `
                border: 1px solid #ccc;
                padding: 2px 5px;
                border-radius: 3px;
                min-width: 40px;
                margin: 0 2px;
                width: ${strongTag.offsetWidth}px;
            `

      strongTag.replaceWith(input)

      inputFields.push({
        element: input,
        correctAnswers: correctAnswers,
        answered: false,
      })
    })

    // Сохраняем оригинальный HTML после замены strong на input
    const originalHTML = tnAtom.innerHTML
    tnAtom.dataset.originalHtml = originalHTML

    inputFields.forEach((field) => {
      field.element.addEventListener('blur', () => {
        if (isQuestionComplete) return

        const value = field.element.value.trim()
        const fieldIndex = inputFields.findIndex(
          (f) => f.element === field.element
        )

        if (value.length > 0) {
          inputFields[fieldIndex].answered = true
          inputFields[fieldIndex].userAnswer = value
          const allFieldsAnswered = inputFields.every((f) => f.answered)

          if (allFieldsAnswered) {
            isQuestionComplete = true
            checkQuestionAnswers(questionId, inputFields)
          }
        } else {
          inputFields[fieldIndex].answered = false
        }
      })

      field.element.addEventListener('keypress', (e) => {
        if (isQuestionComplete) {
          e.preventDefault()
          return
        }

        if (e.key === 'Enter') {
          field.element.blur()
          const nextInput = inputFields.find(
            (f) => !f.answered && f.element !== field.element
          )
          if (nextInput) nextInput.element.focus()
        }
      })
    })

    questions.push({
      questionId,
      inputFields,
      container: tnAtom,
      isQuestionComplete: false,
    })
  })

  function normalizeApostrophes(str) {
    return str.replace(/[’‘‛`]/g, "'")
  }

  function checkQuestionAnswers(questionId, inputFields) {
    let allCorrect = true
    const userAnswers = []
    const correctAnswers = []

    // Получаем элемент вопроса
    const questionElement = testElement.querySelector(
      `[data-question-id="${questionId}"]`
    )

    // Формируем текст вопроса
    let questionText = `Вопрос ${questionId}`
    let imageUrl = null

    if (questionElement) {
      // Проверяем, есть ли отдельный элемент с классом test-question
      const questionInputContainer = questionElement.closest('.test-input')
      const questionGroupContainer =
        questionInputContainer?.closest('.t396__group')
      const separateQuestionElement =
        questionGroupContainer?.querySelector('.test-question')
      const separateQuestion = separateQuestionElement
        ? separateQuestionElement.textContent.trim()
        : null

      // Проверяем, есть ли картинка с классом test-question-img
      // Ищем в той же группе, что и input
      const inputContainer = questionElement.closest('.test-input')
      const groupContainer = inputContainer?.closest('.t396__group')
      const questionImage = groupContainer?.querySelector('.test-question-img')
      const hasImage = questionImage !== null

      if (hasImage && questionImage) {
        // Ищем img внутри элемента test-question-img
        const imgElement = questionImage.querySelector('img')
        if (imgElement) {
          imageUrl = imgElement.getAttribute('data-original')
        }
      }

      // Получаем оригинальный HTML с заменой input на __
      const originalHtml =
        questionElement.dataset.originalHtml || questionElement.innerHTML
      let processedHtml = originalHtml

      // Заменяем все input элементы на ___
      processedHtml = processedHtml.replace(/<input[^>]*>/g, '___')

      // Убираем HTML теги, оставляя только текст
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = processedHtml
      const cleanText = tempDiv.textContent.trim()

      // Формируем финальный текст вопроса
      if (separateQuestion) {
        questionText = separateQuestion + ' ' + cleanText
      } else {
        questionText = cleanText
      }

      // Добавляем указание на картинку, если она есть
      if (hasImage) {
        questionText = ''
      }

      console.log()
    }

    inputFields.forEach((field) => {
      const value = normalizeApostrophes(field.userAnswer.trim().toLowerCase())
      const isCorrect = field.correctAnswers.some(
        (answer) =>
          normalizeApostrophes(answer.trim().toLowerCase()) ===
          value.toLowerCase()
      )

      field.element.style.borderColor = isCorrect ? '#28a745' : '#dc3545'
      userAnswers.push(value)
      correctAnswers.push(
        ...field.correctAnswers.map((a) =>
          normalizeApostrophes(a.trim().toLowerCase())
        )
      )
      field.element.readOnly = true
      field.element.style.backgroundColor = '#f5f5f5'
      field.element.style.cursor = 'not-allowed'

      if (!isCorrect) {
        allCorrect = false
      }
    })

    testBlock.testData[questionId] = {
      questionText: questionText,
      userAnswer: userAnswers.join('; '),
      isCorrect: allCorrect,
      correctAnswer: correctAnswers.join('; '),
      imageUrl: imageUrl,
      inputFields: inputFields.map((field) => ({
        userAnswer: field.userAnswer,
        correctAnswers: field.correctAnswers,
      })),
    }

    testBlock.answeredQuestions = Object.keys(testBlock.testData).length

    if (testBlock.answeredQuestions === testBlock.totalQuestions) {
      saveTestResults(testId)
        .then(() => {
          showTestResults(testId)
          if (window.customAfterTest) {
            const score = calculateTestScore(testBlock.testData)
            const isPassed = isTestPassed(testBlock.testData)
            window.customAfterTest(testId, testBlock.testData, score, isPassed)
          }
        })
        .catch((error) => {
          console.error('Ошибка при сохранении результатов:', error)
        })
    }
  }
}
function initSortableTest(testId) {
  const testBlock = testBlocks[testId]
  const testElement = testBlock.element

  // Находим все контейнеры сортировки внутри этого тестового блока
  const sortableContainers = testElement.querySelectorAll('.test-container')

  testBlock.testData = {}
  testBlock.totalQuestions = sortableContainers.length
  testBlock.answeredQuestions = 0

  // Инициализируем каждый контейнер сортировки
  sortableContainers.forEach((container, containerIndex) => {
    const daysOfWeek = JSON.parse(container.dataset.items.replace(/'/g, '"'))
    const successText = container.dataset.successtext
    const errorText = container.dataset.errortext
    let shuffledDays = [...daysOfWeek].sort(() => Math.random() - 0.5)
    const sortableList = container.querySelector('#sortable-list')
    const resultMessage = container.querySelector('#result-message')

    if (!sortableList) return

    const questionId = `sorting-${containerIndex}`
    sortableList.setAttribute('data-question-id', questionId)

    let selectedItems = []

    const checkBtn = container.querySelector('#check-btn')
    if (checkBtn) checkBtn.style.display = 'none'

    const resetBtn = container.querySelector('#reset-btn')
    if (resetBtn) {
      resetBtn.style.display = 'inline-block'
      resetBtn.addEventListener('click', () =>
        resetTest(container, containerIndex)
      )
    }

    function resetTest(container, index) {
      const days = JSON.parse(container.dataset.items.replace(/'/g, '"'))
      shuffledDays = [...days].sort(() => Math.random() - 0.5)
      const resultMsg = container.querySelector('#result-message')
      if (resultMsg) {
        resultMsg.textContent = ''
        resultMsg.style.color = ''
      }
      createClickableItems(container, index)

      // Удаляем данные этого вопроса из testData
      const qId = `sorting-${index}`
      if (testBlock.testData[qId]) {
        delete testBlock.testData[qId]
        testBlock.answeredQuestions = Object.keys(testBlock.testData).length
      }
    }

    function createClickableItems(container, index) {
      const sortList = container.querySelector('#sortable-list')
      sortList.innerHTML = ''
      selectedItems = []

      shuffledDays.forEach((day) => {
        const item = document.createElement('div')
        item.className = 'day-item'
        item.textContent = day

        item.addEventListener('click', function () {
          if (
            item.classList.contains('selected') ||
            item.classList.contains('correct') ||
            item.classList.contains('incorrect')
          )
            return

          selectedItems.unshift(item)
          updateListDisplay(sortList)
          item.classList.add('selected')

          if (selectedItems.length === daysOfWeek.length) {
            checkOrder(container, index)
          }
        })

        sortList.appendChild(item)
      })
    }

    function checkOrder(container, index) {
      const sortList = container.querySelector('#sortable-list')
      const items = Array.from(sortList.querySelectorAll('.day-item'))
      const correctOrder = [...daysOfWeek]
      const allCorrect = items.every(
        (item, idx) =>
          idx < correctOrder.length && item.textContent === correctOrder[idx]
      )

      items.forEach((item, idx) => {
        item.classList.remove('selected')
        if (
          idx < correctOrder.length &&
          item.textContent === correctOrder[idx]
        ) {
          item.classList.add('correct')
          item.classList.remove('incorrect')
        } else {
          item.classList.add('incorrect')
          item.classList.remove('correct')
        }
      })

      const resultMsg = container.querySelector('#result-message')
      if (resultMsg) {
        if (allCorrect) {
          resultMsg.textContent = successText
          resultMsg.style.color = 'green'
        } else {
          resultMsg.textContent = errorText
          resultMsg.style.color = 'red'
        }
      }

      const questionId = `sorting-${index}`
      testBlock.testData[questionId] = {
        questionText: 'Расставьте слова в правильном порядке',
        userAnswer: items.map((item) => item.textContent).join(', '),
        isCorrect: allCorrect,
        correctAnswer: correctOrder.join(', '),
      }

      testBlock.answeredQuestions = Object.keys(testBlock.testData).length

      if (testBlock.answeredQuestions === testBlock.totalQuestions) {
        saveTestResults(testId)
          .then(() => {
            showTestResults(testId)
          })
          .catch((error) => {
            console.error('Ошибка при сохранении результатов:', error)
          })
      }
    }

    function updateListDisplay(sortList) {
      selectedItems.forEach((item) => {
        sortList.insertBefore(item, sortList.firstChild)
      })

      const allItems = Array.from(sortList.querySelectorAll('.day-item'))
      allItems.forEach((item) => {
        if (!item.classList.contains('selected')) {
          sortList.appendChild(item)
        }
      })
    }

    // Инициализируем первый контейнер
    createClickableItems(container, containerIndex)
  })
}
function initRadioCheckboxTest(testId) {
  const testBlock = testBlocks[testId]
  const testElement = testBlock.element

  testBlock.testData = {}
  testBlock.totalQuestions = 0
  testBlock.answeredQuestions = 0
  const processedQuestions = new Set()
  const questions = []
  const radioContainers = testElement.querySelectorAll('.test-radio')
  radioContainers.forEach((container, index) => {
    const questionId = generateUniqueId(testId, index)
    if (processedQuestions.has(questionId)) return

    processedQuestions.add(questionId)
    testBlock.totalQuestions++

    const ul = container.querySelector('ul')
    if (!ul) return
    const correctItems = []
    // Формируем текст вопроса с учетом картинок
    let questionText = `Вопрос ${index + 1}`

    // Проверяем, есть ли картинка с классом test-question-img
    // Ищем в той же группе, что и контейнер
    const radioGroupContainer = container.closest('.t396__group')
    const questionImage =
      radioGroupContainer?.querySelector('.test-question-img')
    const hasImage = questionImage !== null
    let imageUrl = null
    if (hasImage && questionImage) {
      // Ищем img внутри элемента test-question-img
      const imgElement = questionImage.querySelector('img')
      if (imgElement) {
        imageUrl = imgElement.getAttribute('data-original')
      }
    }

    // Получаем текст вопроса из параграфа
    const questionGroupContainer = radioGroupContainer?.closest('.t396__group')
    const separateQuestionElement =
      questionGroupContainer?.querySelector('.test-question')
    const textQuestion = separateQuestionElement
      ? separateQuestionElement.textContent
      : null
    if (textQuestion) {
      questionText = textQuestion
    }
    // Добавляем указание на картинку, если она есть
    if (hasImage) {
      questionText = ''
    }

    ul.querySelectorAll('li').forEach((li, liIndex) => {
      if (li.querySelector('strong')) {
        correctItems.push(liIndex)
      }
    })

    const isMultiple = correctItems.length > 1
    const inputsContainer = document.createElement('div')
    inputsContainer.className = 'radio-checkbox-container'
    inputsContainer.dataset.questionId = questionId
    ul.querySelectorAll('li').forEach((li, liIndex) => {
      const isCorrect = correctItems.includes(liIndex)
      const text = li.querySelector('strong')
        ? li.querySelector('strong').textContent.trim()
        : li.textContent.trim()

      const inputId = `${questionId}-option-${liIndex}`

      const input = document.createElement('input')
      input.type = isMultiple ? 'checkbox' : 'radio'
      input.name = questionId
      input.id = inputId
      input.value = liIndex
      input.dataset.correct = isCorrect

      const label = document.createElement('label')
      label.htmlFor = inputId
      label.textContent = text
      label.prepend(input)
      inputsContainer.appendChild(label)
      inputsContainer.appendChild(document.createElement('br'))
    })

    ul.replaceWith(inputsContainer)

    questions.push({
      questionId,
      inputsContainer,
      isMultiple,
      correctItems,
      questionText,
      imageUrl,
      isQuestionComplete: false,
    })
  })
  questions.forEach((question) => {
    const {
      questionId,
      inputsContainer,
      isMultiple,
      correctItems,
      questionText,
    } = question

    inputsContainer.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        if (question.isQuestionComplete) return

        const selected = Array.from(
          inputsContainer.querySelectorAll(
            `input[name="${questionId}"]:checked`
          )
        ).map((input) => parseInt(input.value))
        if (
          !isMultiple ||
          (isMultiple && selected.length === correctItems.length)
        ) {
          question.isQuestionComplete = true
          checkQuestionAnswers(question, selected)
        }
      })
    })
  })

  function checkQuestionAnswers(question, selected) {
    const {
      questionId,
      inputsContainer,
      isMultiple,
      correctItems,
      questionText,
      imageUrl,
    } = question
    inputsContainer.querySelectorAll('input').forEach((input) => {
      input.disabled = true
      input.parentElement.style.cursor = 'not-allowed'
    })
    const allCorrect =
      selected.length === correctItems.length &&
      selected.every((val) => correctItems.includes(val))
    inputsContainer.querySelectorAll('label').forEach((label) => {
      label.style.color = ''
      label.style.fontWeight = ''
    })

    if (allCorrect) {
      correctItems.forEach((correctIndex) => {
        const label = inputsContainer.querySelector(
          `input[value="${correctIndex}"]`
        ).parentElement
        label.style.color = 'green'
        label.style.fontWeight = 'bold'
      })
    } else {
      selected.forEach((selectedIndex) => {
        if (!correctItems.includes(selectedIndex)) {
          const label = inputsContainer.querySelector(
            `input[value="${selectedIndex}"]`
          ).parentElement
          label.style.color = 'red'
          label.style.fontWeight = 'bold'
        }
      })
      selected.forEach((selectedIndex) => {
        if (correctItems.includes(selectedIndex)) {
          const label = inputsContainer.querySelector(
            `input[value="${selectedIndex}"]`
          ).parentElement
          label.style.color = 'green'
          label.style.fontWeight = 'bold'
        }
      })
    }

    testBlock.testData[questionId] = {
      questionText: questionText,
      userAnswers: selected.map((index) =>
        inputsContainer
          .querySelector(`input[value="${index}"]`)
          .parentElement.textContent.trim()
      ),
      isCorrect: allCorrect,
      correctAnswers: correctItems.map((index) =>
        inputsContainer
          .querySelector(`input[value="${index}"]`)
          .parentElement.textContent.trim()
      ),
      answerOptions: Array.from(inputsContainer.querySelectorAll('label')).map(
        (label) => label.textContent.trim()
      ),
      imageUrl: imageUrl,
    }

    testBlock.answeredQuestions = Object.keys(testBlock.testData).length
    if (testBlock.answeredQuestions === testBlock.totalQuestions) {
      saveTestResults(testId)
        .then(() => {
          showTestResults(testId)
        })
        .catch((error) => {
          console.error('Ошибка при сохранении результатов:', error)
        })
    }
  }
}

// Экспортируем функцию для homework.js
window.onHomeworkCompleted = onHomeworkCompleted
