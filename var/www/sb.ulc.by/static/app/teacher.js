// ==================== Конфигурационные константы ====================
const teacherData = getTildaUserData()
const teacherEmail = teacherData.data.login

// ==================== Вспомогательные функции ====================
function normalizePhoneNumber(phone) {
  return phone.replace(/\D/g, '')
}
// Функция форматирования телефона
function formatPhone(phone) {
  if (!phone || phone.length < 11) return 'Не указано'
  return `+${phone.substring(0, 3)} (${phone.substring(
    3,
    5
  )}) ${phone.substring(5, 8)}-${phone.substring(8, 10)}-${phone.substring(10)}`
}

function getTildaUserData() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('tilda_members_profile')) {
      try {
        const userData = JSON.parse(localStorage.getItem(key))
        if (userData && userData.login) {
          return { key, data: userData }
        }
      } catch (e) {
        console.error('Ошибка парсинга данных пользователя:', e)
      }
    }
  }
  return null
}
async function getStudentNextLesson(number) {
  try {
    if (!number) return { nextLessonDate: null }

    const res = await fetch(
      'https://sb.ulc.by/functions/v1/student-next-lesson',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: number }),
      }
    )

    if (!res.ok) {
      // Тихий fail для 404 и 400 ошибок
      if (res.status === 404 || res.status === 400) {
        return { nextLessonDate: null }
      }
      // Для других ошибок можно логировать
      console.warn(
        `Next lesson request failed for phone: ${number}, status: ${res.status}`
      )
      return { nextLessonDate: null }
    }

    const data = await res.json()

    // Обрабатываем разные форматы ответа
    if (data.nextLessonDate) {
      return data
    } else if (data.ДатаСледующегоУрока) {
      return { nextLessonDate: data.ДатаСледующегоУрока }
    } else if (data.date) {
      return { nextLessonDate: data.date }
    } else {
      return { nextLessonDate: null }
    }
  } catch (error) {
    // Тихий fail для сетевых ошибок
    return { nextLessonDate: null }
  }
}
async function getTeacherStudentsFrom1C(email) {
  const res = await fetch('https://sb.ulc.by/functions/v1/getStudentsFrom1C', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return res.json()
}
function getTimeUntilLesson(lessonDateTime) {
  // Парсим дату урока (формат "DD.MM.YYYY HH:mm:ss")
  const [datePart, timePart] = lessonDateTime.split(' ')
  const [day, month, year] = datePart.split('.')
  const [hours, minutes, seconds] = timePart.split(':')

  // Создаем объект Date для урока (месяцы в JS 0-11)
  const lessonDate = new Date(year, month - 1, day, hours, minutes, seconds)
  const now = new Date()

  // Разница в миллисекундах
  const diffMs = lessonDate - now

  // Если урок уже прошел
  if (diffMs <= 0) {
    return {
      isPast: true,
      message: 'Урок уже начался или завершился',
      lessonDate: lessonDate,
    }
  }

  // Рассчитываем оставшееся время
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  )
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000)

  // Форматируем вывод
  let message = ''
  if (diffDays > 0) {
    message = `${diffDays} дн. ${diffHours} ч. ${diffMinutes} мин.`
  } else if (diffHours > 0) {
    message = `${diffHours} ч. ${diffMinutes} мин. ${diffSeconds} сек.`
  } else {
    message = `${diffMinutes} мин. ${diffSeconds} сек.`
  }

  return {
    isPast: false,
    totalMs: diffMs,
    days: diffDays,
    hours: diffHours,
    minutes: diffMinutes,
    seconds: diffSeconds,
    message: `До урока: ${message}`,
    lessonDate: lessonDate,
  }
}

// Добавляем хранилище для таймеров
const lessonTimers = new WeakMap()

function updateTeacherLessonButton(buttonElement, serverData) {
  if (!buttonElement || !serverData?.nextLessonDate) {
    if (!buttonElement) console.error('Кнопка не передана')
    if (!serverData?.nextLessonDate) console.warn('Нет данных о уроке')
    return
  }

  // Очищаем предыдущий таймер для этой кнопки
  const existingTimer = lessonTimers.get(buttonElement)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timeLeft = getTimeUntilLesson(serverData.nextLessonDate)
  const [datePart, timePart] = serverData.nextLessonDate.split(' ')
  const [day, month, year] = datePart.split('.')
  const [hours, minutes] = timePart.split(':')
  const lessonDate = new Date(year, month - 1, day, hours, minutes)
  const now = new Date()
  const timeDiff = lessonDate - now
  const tenMinutes = 10 * 60 * 1000

  // Базовые стили
  Object.assign(buttonElement.style, {
    display: 'block',
    border: '1px solid #f02e2e',
    borderRadius: '100px',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: "'Wix Madefor Display', Arial, sans-serif",
    marginTop: '10px',
    padding: '15px 20px',
    pointerEvents: 'none',
  })

  if (timeDiff <= 0) {
    // Урок уже начался - финальное состояние
    Object.assign(buttonElement.style, {
      backgroundColor: '#f02e2e',
      color: '#fff',
      pointerEvents: 'auto',
    })
    buttonElement.disabled = false
    buttonElement.textContent = 'Создать видеоурок'
    return // Выходим, больше не обновляем
  } else if (timeDiff <= tenMinutes) {
    // До урока <= 10 минут
    Object.assign(buttonElement.style, {
      backgroundColor: '#f02e2e',
      pointerEvents: 'auto',
      color: '#fff',
    })
    buttonElement.disabled = false
    buttonElement.textContent = 'Создать видеоурок'

    // Обновляем каждую секунду
    const timer = setTimeout(() => {
      updateTeacherLessonButton(buttonElement, serverData)
    }, 1000)
    lessonTimers.set(buttonElement, timer)
  } else {
    // Урок через > 10 минут
    Object.assign(buttonElement.style, {
      backgroundColor: 'transparent',
      color: '#f02e2e',
    })
    buttonElement.disabled = true
    buttonElement.innerHTML = `${timeLeft.message}`

    // Обновляем через 1 секунду (для точности) или когда останется 10 минут
    const updateDelay = Math.min(1000, timeDiff - tenMinutes)
    const timer = setTimeout(() => {
      updateTeacherLessonButton(buttonElement, serverData)
    }, updateDelay)
    lessonTimers.set(buttonElement, timer)
  }
}

async function getStudents() {
  // Функция для получения пользователя по телефону
  async function getUserByPhone(studentPhone) {
    try {
      if (!studentPhone) return null

      const result = await api.getUserByPhone(studentPhone)
      return result?.success ? result.data : null
    } catch (error) {
      return null
    }
  }

  async function getTestResults(userId, level = 'beginner') {
    try {
      if (!userId) {
        console.error('User ID is required')
        return []
      }

      const result = await api.getTestResults(userId, level)
      if (!result) {
        return []
      }

      // Преобразуем данные для удобного отображения
      return result
    } catch (error) {
      console.error('Error in getTestResults:', {
        userId,
        level,
        error: error.message,
      })
      return []
    }
  }

  // Функция для определения класса уровня
  function getLevelClass(level) {
    switch (level) {
      case 'Beginners':
        return 'beginners'
      case 'Elementary':
        return 'elementary'
      case 'Pre-intermediate':
        return 'pre-intermediate'
      case 'Intermediate':
        return 'intermediate'
      case 'Intermediate +':
        return 'intermediate-plus'
      case 'SpecCourse':
        return 'spec-course'
      default:
        return 'spec-course'
    }
  }

  // Функция анализа результатов тестов
  // Функция анализа результатов тестов
  function analyzeTestResults(testResults) {
    if (!testResults || !testResults.length) {
      console.log('Нет данных тестов для анализа')
      return null
    }

    // Функция для форматирования названия теста
    function formatTestName(testId) {
      if (!testId) return 'Без названия'

      // Удаляем префикс с user_id и _
      const formattedName = testId.replace(/^\d+_/, '')

      // Если это homework, оставляем как есть
      if (formattedName.includes('homework')) {
        return formattedName
      }

      // Для остальных тестов убираем префикс uc- если есть
      return formattedName.replace(/^uc-/, '')
    }

    // Функция для сортировки тестов
    function sortTests(a, b) {
      const nameA = formatTestName(a.test_id)
      const nameB = formatTestName(b.test_id)

      // homework всегда идет последним
      if (nameA.includes('homework') && !nameB.includes('homework')) return 1
      if (!nameA.includes('homework') && nameB.includes('homework')) return -1

      // Сортируем по алфавиту
      return nameA.localeCompare(nameB)
    }

    // Сортируем тесты
    const sortedTests = [...testResults].sort(sortTests)

    const totalScore = sortedTests.reduce(
      (sum, test) => sum + (test.score || 0),
      0
    )
    const averageScore = Math.round(totalScore / sortedTests.length)

    const lastTest = sortedTests[0]

    return {
      averageScore,
      lastTestScore: lastTest?.score || 0,
      lastTestDate: lastTest?.completed_at
        ? new Date(lastTest.completed_at).toLocaleDateString()
        : 'Не указано',
      passedTests: sortedTests.filter((t) => t.is_passed).length,
      totalTests: sortedTests.length,
      allTests: sortedTests,
      // Добавляем функцию форматирования для использования в других местах
      formatTestName: formatTestName,
    }
  }

  function createModal(studentName, testAnalysis) {
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.style.display = 'none'
    modal.style.position = 'fixed'
    modal.style.zIndex = '1000'
    modal.style.left = '0'
    modal.style.top = '0'
    modal.style.width = '100%'
    modal.style.height = '100%'
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'

    const modalContent = document.createElement('div')
    modalContent.className = 'modal-content'
    modalContent.style.backgroundColor = 'white'
    modalContent.style.padding = '20px'
    modalContent.style.borderRadius = '8px'
    modalContent.style.maxWidth = '600px'
    modalContent.style.width = '90%'
    modalContent.style.maxHeight = '80vh'
    modalContent.style.overflowY = 'auto'

    const closeBtn = document.createElement('span')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.position = 'absolute'
    closeBtn.style.right = '20px'
    closeBtn.style.top = '10px'
    closeBtn.style.fontSize = '28px'
    closeBtn.style.cursor = 'pointer'

    const closeModal = () => {
      modal.style.display = 'none'
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300)
    }

    closeBtn.onclick = closeModal

    const title = document.createElement('h3')
    title.textContent = `Результаты тестов: ${studentName}`
    title.style.marginTop = '0'

    const resultsInfo = document.createElement('div')
    resultsInfo.innerHTML = `
      <p><strong>Средний балл:</strong> ${testAnalysis.averageScore}%</p>
      <p><strong>Последний тест:</strong> ${testAnalysis.lastTestScore}% (${testAnalysis.lastTestDate})</p>
      <p><strong>Пройдено тестов:</strong> ${testAnalysis.passedTests} из ${testAnalysis.totalTests}</p>
      <h4>Детали тестов: <span style="font-size: 12px; color: #666; font-weight: normal;">(кликните на тест для просмотра деталей)</span></h4>
  `

    const testDetails = document.createElement('div')
    testDetails.className = 'test-details-list'

    testAnalysis.allTests.forEach((test) => {
      const testItem = document.createElement('div')
      testItem.className = 'test-item'
      testItem.style.display = 'flex'
      testItem.style.justifyContent = 'space-between'
      testItem.style.padding = '5px 0'
      testItem.style.borderBottom = '1px solid #eee'
      testItem.style.cursor = 'pointer'

      // Используем отформатированное название теста
      const formattedTestName = testAnalysis.formatTestName(test.test_id)

      testItem.innerHTML = `
          <strong>${formattedTestName}</strong>
          <span>${test.score}%</span>
          <span>${new Date(test.completed_at).toLocaleDateString()}</span>
          <span>${test.is_passed ? '✅' : '❌'}</span>
          <span style="font-size: 12px; color: #666;">📋</span>
      `

      testItem.addEventListener('click', () => {
        showTestDetails(test, studentName)
      })

      testDetails.appendChild(testItem)
    })

    modalContent.appendChild(closeBtn)
    modalContent.appendChild(title)
    modalContent.appendChild(resultsInfo)
    modalContent.appendChild(testDetails)
    modal.appendChild(modalContent)

    modal.onclick = (e) => {
      if (e.target === modal) {
        closeModal()
      }
    }

    document.body.appendChild(modal)

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }

    document.addEventListener('keydown', handleEscape)
    modal._handleEscape = handleEscape

    return modal
  }

  async function createGroupCard(groupName, students, cardTemplate) {
    const groupCard = document.createElement('div')
    groupCard.className = 'group-card'
    groupCard.style.marginBottom = '20px'
    groupCard.style.overflow = 'hidden'
    groupCard.style.background = '#eee7ea'
    groupCard.style.borderRadius = '30px'
    groupCard.style.marginTop = '90px'

    const groupHeader = document.createElement('div')
    groupHeader.className = 'group-header'
    groupHeader.textContent = `Группа: ${groupName}`

    const studentsContainer = document.createElement('div')
    studentsContainer.className = 'group-students-container'

    groupCard.appendChild(groupHeader)
    groupCard.appendChild(studentsContainer)

    for (const student of students) {
      try {
        const card = await createStudentCard(student, cardTemplate)
        if (card && card.nodeType === Node.ELEMENT_NODE) {
          studentsContainer.appendChild(card)
        }
      } catch (error) {
        console.error('Ошибка при создании карточки студента:', error)
      }
    }

    return groupCard
  }

  try {
    const cardTemplate = document.querySelector('.student-card-template')
    const container = document.querySelector('.students-container')

    if (!cardTemplate) {
      console.error('Не найден шаблон карточки студента')
      return
    }

    if (!container) {
      console.error('Не найден контейнер для карточек студентов')
      return
    }

    container.innerHTML = ''

    const res = await getTeacherStudentsFrom1C(teacherEmail)
    const students = res.students
    const individualStudents = []
    const groupStudents = {}

    students.forEach((student) => {
      if (!student) return

      if (student.group && student.group.includes('_Инд')) {
        individualStudents.push(student)
      } else {
        const groupName = student.group || 'Без группы'
        if (!groupStudents[groupName]) {
          groupStudents[groupName] = []
        }
        groupStudents[groupName].push(student)
      }
    })

    for (const student of individualStudents) {
      try {
        const card = await createStudentCard(student, cardTemplate)
        if (card) {
          container.appendChild(card)
        }
      } catch (error) {
        console.error('Ошибка при создании карточки:', error)
      }
    }

    for (const [groupName, studentsInGroup] of Object.entries(groupStudents)) {
      try {
        const groupCard = await createGroupCard(
          groupName,
          studentsInGroup,
          cardTemplate
        )
        if (groupCard && groupCard.nodeType === Node.ELEMENT_NODE) {
          container.appendChild(groupCard)
        }
      } catch (error) {
        console.error('Ошибка при создании карточки группы:', error)
      }
    }
  } catch (error) {
    console.error('Ошибка:', error)
    const container = document.querySelector('.students-container')
    if (container) {
      container.innerHTML = '<p class="error">Ошибка загрузки данных</p>'
    }
  }

  async function createStudentCard(student, template) {
    try {
      if (!student || !template || !template.cloneNode) {
        console.error('Неверные параметры для создания карточки')
        return null
      }
      const serverData = await getStudentNextLesson(student.studentPhone)
      const card = template.cloneNode(true)
      card.style.display = 'block'

      const levelClass = getLevelClass(student.disciplineLevel)
      if (levelClass) card.classList.add(levelClass)

      const elements = {
        name: card.querySelector('.student-name'),
        group: card.querySelector('.student-group'),
        phone: card.querySelector('.student-phone'),
        level: card.querySelector('.student-level'),
        lessons: card.querySelector('.lessons-count'),
        info: card.querySelector('.student-info'),
        btnContain: card.querySelector('.btn-container'),
        testResults: card.querySelector('.test-results'),
        lessonDate: card.querySelector('.lesson-date'),
      }

      if (
        !elements.name ||
        !elements.group ||
        !elements.phone ||
        !elements.level ||
        !elements.lessons ||
        !elements.info
      ) {
        console.error('Не найдены необходимые элементы в шаблоне карточки')
        return null
      }

      elements.name.textContent = student.studentName || 'Имя не указано'
      elements.group.textContent = student.group || 'Группа не указана'
      elements.phone.textContent = formatPhone(student.studentPhone)
      elements.level.textContent =
        student.disciplineLevel || 'Уровень не указан'
      elements.lessonDate.textContent =
        serverData.nextLessonDate || 'Дата не найдена'

      const userData = await getUserByPhone(student.studentPhone)
      if (userData) {
        elements.lessons.textContent = userData.lesson_number || '0'
        const testResults = await getTestResults(userData.id)
        if (testResults && testResults.length > 0) {
          const analysis = analyzeTestResults(testResults)
          const resultsBtn = document.createElement('button')
          resultsBtn.textContent = 'Результаты тестов'
          resultsBtn.style.marginTop = '10px'
          resultsBtn.style.padding = '15px 20px'
          resultsBtn.style.backgroundColor = 'rgb(60 74 245)'
          resultsBtn.style.color = 'white'
          resultsBtn.style.border = 'none'
          resultsBtn.style.borderRadius = '100px'
          resultsBtn.style.cursor = 'pointer'
          resultsBtn.style.fontSize = '14px'
          resultsBtn.style.fontFamily =
            "'Wix Madefor Display', Arial, sans-serif"

          // Изменено: создаем модальное окно при каждом клике, а не заранее
          resultsBtn.onclick = () => {
            const modal = createModal(student.studentName, analysis)
            modal.style.display = 'flex'
          }

          elements.btnContain.appendChild(resultsBtn)
        }

        const lessonBtn = document.createElement('button')
        lessonBtn.textContent = 'Создать урок'
        lessonBtn.style.marginTop = '10px'
        lessonBtn.style.padding = '15px 20px'
        lessonBtn.style.backgroundColor = '#f02e2e'
        lessonBtn.style.color = 'white'
        lessonBtn.style.border = 'none'
        lessonBtn.style.borderRadius = '100px'
        lessonBtn.style.cursor = 'pointer'
        lessonBtn.style.fontSize = '14px'
        lessonBtn.style.fontFamily = "'Wix Madefor Display', Arial, sans-serif"
        lessonBtn.classList.add('button-video-lesson')
        lessonBtn.onclick = async () => {
          await generateLinks(userData, student)
        }

        elements.btnContain.appendChild(lessonBtn)

        if (serverData?.nextLessonDate) {
          updateTeacherLessonButton(lessonBtn, serverData)
        } else {
          console.warn(
            'Нет данных о следующем уроке для студента',
            student.studentName
          )
        }
      } else {
        elements.lessons.textContent = '0'

        const noStudent = document.createElement('h4')
        noStudent.textContent = 'Не зарегистрирован в ЛМС'
        noStudent.style.color = '#f02e2e'
        noStudent.style.fontSize = '16px'
        noStudent.style.marginTop = '25px'
        noStudent.style.fontFamily = "'Wix Madefor Display', Arial, sans-serif"

        elements.info.appendChild(noStudent)
      }

      return card
    } catch (error) {
      console.error('Ошибка при создании карточки:', error)
      return null
    }
  }

  function extractDateRange(courseStr) {
    if (!courseStr) return null
    const dateRegex = /(\d{2}\.\d{2}\.\d{4})/g
    const dates = courseStr.match(dateRegex)
    return dates?.length >= 2 ? { start: dates[0], end: dates[1] } : null
  }

  function showTestDetails(test, studentName) {
    const modal = document.createElement('div')
    modal.className = 'test-details-modal'
    modal.style.display = 'flex'
    modal.style.position = 'fixed'
    modal.style.zIndex = '1001'
    modal.style.left = '0'
    modal.style.top = '0'
    modal.style.width = '100%'
    modal.style.height = '100%'
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'

    const modalContent = document.createElement('div')
    modalContent.className = 'test-details-content'
    modalContent.style.backgroundColor = 'white'
    modalContent.style.padding = '20px'
    modalContent.style.borderRadius = '8px'
    modalContent.style.maxWidth = '800px'
    modalContent.style.width = '90%'
    modalContent.style.maxHeight = '80vh'
    modalContent.style.overflowY = 'auto'
    modalContent.style.fontFamily = 'Wix Madefor Display'

    const closeBtn = document.createElement('span')
    closeBtn.innerHTML = '×'
    closeBtn.style.position = 'absolute'
    closeBtn.style.right = '20px'
    closeBtn.style.top = '10px'
    closeBtn.style.fontSize = '28px'
    closeBtn.style.cursor = 'pointer'

    // Функция для закрытия и удаления модального окна
    const closeModal = () => {
      modal.style.display = 'none'
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300) // Небольшая задержка для анимации
    }

    closeBtn.onclick = closeModal

    const title = document.createElement('h3')
    title.style.marginTop = '0'
    title.textContent = `Детали теста: ${test.test_id} - ${studentName}`

    const testInfo = document.createElement('div')
    testInfo.innerHTML = `
        <p><strong>Результат:</strong> ${test.score}% ${
      test.is_passed ? '✅' : '❌'
    }</p>
        <p><strong>Дата прохождения:</strong> ${new Date(
          test.completed_at
        ).toLocaleDateString()}</p>
    `

    const detailsContainer = document.createElement('div')
    detailsContainer.className = 'answers-review'
    detailsContainer.style.marginTop = '20px'
    detailsContainer.style.textAlign = 'left'

    const detailsTitle = document.createElement('h4')
    detailsTitle.textContent = 'Разбор ответов:'
    detailsContainer.appendChild(detailsTitle)

    // Обрабатываем разные форматы данных теста
    if (
      test.test_data &&
      test.test_data.tasks &&
      Array.isArray(test.test_data.tasks)
    ) {
      test.test_data.tasks.forEach((task, index) => {
        const isCorrect = task.is_correct
        const taskReview = createTaskReview(isCorrect, task, index + 1)
        detailsContainer.appendChild(taskReview)
      })
    } else if (test.test_data && typeof test.test_data === 'object') {
      let questionNumber = 1
      Object.entries(test.test_data).forEach(([questionId, questionData]) => {
        if (
          questionId === 'level' ||
          questionId === 'stats' ||
          questionId === 'lesson'
        ) {
          return
        }

        const isCorrect =
          questionData.isCorrect !== undefined ? questionData.isCorrect : true
        const taskReview = createTaskReview(
          isCorrect,
          questionData,
          questionNumber
        )
        detailsContainer.appendChild(taskReview)
        questionNumber++
      })
    } else {
      const noData = document.createElement('p')
      noData.textContent = 'Детальные данные теста недоступны'
      noData.style.color = '#666'
      detailsContainer.appendChild(noData)
    }

    modalContent.appendChild(closeBtn)
    modalContent.appendChild(title)
    modalContent.appendChild(testInfo)
    modalContent.appendChild(detailsContainer)
    modal.appendChild(modalContent)

    modal.onclick = (e) => {
      if (e.target === modal) {
        closeModal()
      }
    }

    document.body.appendChild(modal)

    // Добавляем обработчик клавиши ESC
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }

    document.addEventListener('keydown', handleEscape)

    // Удаляем обработчик при уничтожении модального окна
    modal._handleEscape = handleEscape
  }

  // Вспомогательная функция для создания элемента отзыва о задании
  function createTaskReview(isCorrect, taskData, questionNumber) {
    const taskReview = document.createElement('div')
    taskReview.className = 'task-review'
    taskReview.style.marginBottom = '15px'
    taskReview.style.padding = '10px'
    taskReview.style.background = isCorrect ? '#e8f5e9' : '#ffebee'
    taskReview.style.borderLeft = `3px solid ${
      isCorrect ? '#4CAF50' : '#F44336'
    }`

    let imageHtml = ''
    if (taskData.imageUrl) {
      imageHtml = `<div style="margin: 10px 0;"><img src="${taskData.imageUrl}" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;" alt="Изображение к вопросу"></div>`
    }

    let userAnswerText = ''
    let correctAnswerText = ''

    // Обрабатываем разные форматы ответов
    if (taskData.userAnswers && Array.isArray(taskData.userAnswers)) {
      userAnswerText = taskData.userAnswers.join(', ')
    } else if (taskData.userAnswer) {
      userAnswerText = taskData.userAnswer
    } else if (taskData.inputFields && Array.isArray(taskData.inputFields)) {
      userAnswerText = taskData.inputFields
        .map((field) => field.userAnswer || '')
        .join(', ')
    }

    if (taskData.correctAnswers && Array.isArray(taskData.correctAnswers)) {
      correctAnswerText = taskData.correctAnswers.join(', ')
    } else if (taskData.correctAnswer) {
      correctAnswerText = taskData.correctAnswer
    } else if (taskData.inputFields && Array.isArray(taskData.inputFields)) {
      correctAnswerText = taskData.inputFields
        .map((field) =>
          field.correctAnswers ? field.correctAnswers.join(', ') : ''
        )
        .join(', ')
    }

    const questionText = taskData.questionText || taskData.description || ''

    taskReview.innerHTML = `
        <p><strong>Вопрос ${questionNumber}:</strong> ${questionText}</p>
        ${imageHtml}
        <p>Ваш ответ: <span style="color: ${
          isCorrect ? '#4CAF50' : '#F44336'
        }; font-weight: bold;">${userAnswerText || '—'}</span></p>
        <p>Правильный ответ: <span style="color: #4CAF50; font-weight: bold;">${
          correctAnswerText || '—'
        }</span></p>
    `

    return taskReview
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(getStudents, 100)
})
