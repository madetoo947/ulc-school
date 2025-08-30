let testData = { tasks: [] }
let currentQuestion = 0
let userAnswers = []
let score = 0

const generateBtn = document.getElementById('generateBtn')
const generateSection = document.getElementById('generator-section')
const messageEl = document.getElementById('message')
const testContainer = document.querySelector('.homework-container')
const questionsContainer = document.getElementById('questions-container')
const checkButton = document.getElementById('check-answers')
const nextButton = document.getElementById('next-question')
const showResultsButton = document.getElementById('show-results')
const resultsDiv = document.getElementById('results')
const totalQuestionsSpan = document.getElementById('total-questions')
let levelName = getCurrentLevelFromUrl()
let lessonName = getCurrentLessonFromUrl()

// Проверяем доступность домашнего задания
function checkHomeworkAvailability() {
  const key = `tests_completed_${levelName}_${lessonName}`
  const testsCompleted = localStorage.getItem(key) === 'true'

  if (!testsCompleted) {
    // Блокируем домашнее задание
    generateBtn.disabled = true
    generateBtn.textContent = 'Сначала пройдите все тесты'
    generateBtn.style.backgroundColor = '#ccc'
    generateBtn.style.cursor = 'not-allowed'

    messageEl.textContent =
      'Домашнее задание будет доступно после прохождения всех тестов урока'
    messageEl.style.color = '#666'
  } else {
    // Разблокируем домашнее задание
    generateBtn.disabled = false
    generateBtn.textContent = 'Создать ДЗ'
    generateBtn.style.backgroundColor = '#3c4af5'
    generateBtn.style.cursor = 'pointer'

    messageEl.textContent = 'Домашнее задание доступно!'
    messageEl.style.color = '#4CAF50'
  }
}

// Функция для разблокировки домашнего задания (вызывается из script.js)
window.homeworkUnlocked = function () {
  checkHomeworkAvailability()
}

async function generateTest() {
  // Проверяем доступность перед генерацией
  const key = `tests_completed_${levelName}_${lessonName}`
  const testsCompleted = localStorage.getItem(key) === 'true'

  if (!testsCompleted) {
    messageEl.textContent = 'Сначала пройдите все тесты урока'
    messageEl.style.color = '#F44336'
    return
  }

  generateBtn.disabled = true
  messageEl.textContent = 'Идёт генерация теста...'
  testContainer.style.display = 'none'

  try {
    const response = await fetch(
      `https://sb.ulc.by/functions/v1/generate-beginner-homework`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userData.id,
          level: levelName,
          lesson: lessonName,
        }),
      }
    )

    const result = await processResponse(response)
    testData = result.homework

    initTest()
    generateSection.style.display = 'none'
    testContainer.style.display = 'block'
    messageEl.textContent = result.cached
      ? 'Загружено ваше предыдущее домашнее задание'
      : 'Новое домашнее задание готово!'
  } catch (error) {
    console.error('Ошибка:', error)
    messageEl.textContent = 'Ошибка: ' + (error.message || 'Неизвестная ошибка')
    testContainer.style.display = 'none'
  } finally {
    generateBtn.disabled = false
  }
}

async function processResponse(response) {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Ошибка сервера')
  }

  const data = await response.json()

  let homeworkData = data.homework
  if (typeof homeworkData === 'string') {
    try {
      homeworkData = JSON.parse(homeworkData)
    } catch (e) {
      console.error('Failed to parse homework:', e)
      throw new Error('Неверный формат домашнего задания')
    }
  }

  if (!homeworkData?.tasks || !Array.isArray(homeworkData.tasks)) {
    console.error('Invalid homework structure:', homeworkData)
    throw new Error('Неверная структура теста')
  }

  return {
    homework: homeworkData,
    cached: data.cached || false,
  }
}

function initTest() {
  currentQuestion = 0
  userAnswers = []
  score = 0
  totalQuestionsSpan.textContent = testData.tasks.length
  showQuestion(currentQuestion)
  resultsDiv.style.display = 'none'
}

function showQuestion(index) {
  const question = testData.tasks[index]

  document.querySelector('.progress').textContent = `Вопрос ${index + 1} из ${
    testData.tasks.length
  }`
  let html = `
                <div class="question">
                    <div class="question-title">${
                      question.title
                    } <span class="question-type">${getTypeName(
    question.type
  )}</span></div>
                    <p>${question.description}</p>
                    <div class="options">
            `

  question.options.forEach((option, i) => {
    html += `<div class="option" data-index="${i}">${option}</div>`
  })

  html += `</div></div>`
  questionsContainer.innerHTML = html

  document.querySelectorAll('.option').forEach((option) => {
    option.addEventListener('click', function () {
      document.querySelectorAll('.option').forEach((opt) => {
        opt.classList.remove('selected')
      })

      this.classList.add('selected')
      checkButton.disabled = false
      userAnswers[index] = parseInt(this.dataset.index)
    })
  })

  checkButton.style.display = 'block'
  nextButton.style.display = 'none'
  showResultsButton.style.display = 'none'
  checkButton.disabled = true
}

function checkAnswer() {
  const question = testData.tasks[currentQuestion]
  const userAnswerIndex = userAnswers[currentQuestion]
  const isCorrect =
    question.options[userAnswerIndex] === question.correct_answer

  if (isCorrect) score++

  document.querySelectorAll('.option').forEach((option, i) => {
    if (question.options[i] === question.correct_answer) {
      option.classList.add('correct')
    } else if (i === userAnswerIndex) {
      option.classList.add('incorrect')
    }
    option.style.cursor = 'default'
  })

  document.querySelectorAll('.option').forEach((option) => {
    option.onclick = null
  })

  checkButton.style.display = 'none'

  if (currentQuestion < testData.tasks.length - 1) {
    nextButton.style.display = 'block'
  } else {
    showResultsButton.style.display = 'block'
  }
}

async function showResults() {
  resultsDiv.style.display = 'block'
  const percent = Math.round((score / testData.tasks.length) * 100)

  resultsDiv.innerHTML = `
    <h3>Результаты домашнего задания</h3>
    <p>Правильных ответов: ${score} из ${testData.tasks.length}</p>
    <p>Процент выполнения: ${percent}%</p>
  `

  // Подготовка данных для сохранения
  const homeworkData = {
    tasks: testData.tasks,
    userAnswers: userAnswers,
    completedAt: new Date().toISOString(),
  }

  try {
    // Сохраняем результаты
    const result = await api.saveHomeworkResults(
      userData.id,
      lessonName,
      levelName,
      homeworkData
    )

    if (result.success) {
      console.log('Домашнее задание сохранено:', result.data)

      // Дополнительно показываем разбор ответов
      resultsDiv.innerHTML += `<div class="answers-review" style="margin-top: 20px; text-align: left;">
        <h4>Разбор ответов:</h4>
        ${testData.tasks
          .map((task, index) => {
            const isCorrect =
              task.correct_answer === task.options[userAnswers[index]]
            return `
            <div class="task-review" style="margin-bottom: 15px; padding: 10px; 
                  background: ${isCorrect ? '#e8f5e9' : '#ffebee'}; 
                  border-left: 3px solid ${isCorrect ? '#4CAF50' : '#F44336'};">
              <p><strong>Вопрос ${index + 1}:</strong> ${task.description}</p>
              <p>Ваш ответ: <span style="color: ${
                isCorrect ? '#4CAF50' : '#F44336'
              }; 
                              font-weight: bold;">${
                                task.options[userAnswers[index]]
                              }</span></p>
              <p>Правильный ответ: <span style="color: #4CAF50; font-weight: bold;">${
                task.correct_answer
              }</span></p>
            </div>
          `
          })
          .join('')}
      </div>`

      if (window.onHomeworkCompleted) {
        window.onHomeworkCompleted()
      }
    } else {
      resultsDiv.innerHTML +=
        '<p style="color: #F44336;">Не удалось сохранить результаты</p>'
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    resultsDiv.innerHTML +=
      '<p style="color: #F44336;">Ошибка при сохранении результатов</p>'
  }
}

function getTypeName(type) {
  const types = {
    vocabulary: 'Лексика',
    grammar: 'Грамматика',
    dialogue: 'Диалог',
    matching: 'Соответствие',
  }
  return types[type] || type
}

generateBtn.addEventListener('click', generateTest)
checkButton.addEventListener('click', checkAnswer)
nextButton.addEventListener('click', () => {
  currentQuestion++
  showQuestion(currentQuestion)
})
showResultsButton.addEventListener('click', showResults)

window.addEventListener('DOMContentLoaded', () => {
  hideLoad()
  checkHomeworkAvailability()
})
