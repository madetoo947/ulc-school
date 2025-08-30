document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_FUNCTION_URL = 'https://sb.ulc.by/functions/v1/chat-assistant'

  const chatContainer = document.getElementById('chat-container')
  const chatWidget = document.getElementById('chat-widget')
  const toggleBtn = document.getElementById('chat-toggle-btn')
  const chatBody = document.getElementById('chat-body')
  const userInput = document.getElementById('user-input')
  const sendBtn = document.getElementById('send-btn')

  const STORAGE_HISTORY = 'ulc_chat_history_v1'
  const STORAGE_OPEN = 'ulc_chat_open_v1'
  const STORAGE_THREAD = 'ulc_chat_thread_v1'
  const MAX_HISTORY = 200

  let history = []
  let threadId = null
  let merged = false
  let animating = false

  const saveHistory = () => {
    try {
      localStorage.setItem(
        STORAGE_HISTORY,
        JSON.stringify(history.slice(-MAX_HISTORY))
      )
    } catch {}
  }
  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }
  const saveOpenState = (isOpen) => {
    try {
      localStorage.setItem(STORAGE_OPEN, isOpen ? '1' : '0')
    } catch {}
  }
  const loadOpenState = () => {
    try {
      return localStorage.getItem(STORAGE_OPEN) === '1'
    } catch {
      return false
    }
  }
  const saveThread = (id) => {
    try {
      localStorage.setItem(STORAGE_THREAD, id || '')
    } catch {}
  }
  const loadThread = () => {
    try {
      return localStorage.getItem(STORAGE_THREAD) || null
    } catch {
      return null
    }
  }

  const appendMessage = (text, className, persist = true) => {
    const el = document.createElement('div')
    el.classList.add('chat-message', className)
    el.textContent = text
    chatBody.appendChild(el)
    chatBody.scrollTop = chatBody.scrollHeight
    if (persist) {
      history.push({ role: className === 'user-message' ? 'user' : 'ai', text })
      saveHistory()
    }
  }

  const showTyping = (label = 'Печатает') => {
    const wrap = document.createElement('div')
    wrap.className = 'chat-message ai-message typing'
    wrap.setAttribute('data-typing', '1')
    wrap.innerHTML = `<span>${label}</span><span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`
    chatBody.appendChild(wrap)
    chatBody.scrollTop = chatBody.scrollHeight
    return wrap
  }

  const hideTyping = (el) => {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  }

  const renderHistory = () => {
    chatBody.innerHTML = ''
    if (!history.length) {
      const greeting =
        'Здравствуйте! Рад помочь вам с любыми вопросами о нашей школе.'
      history = [{ role: 'ai', text: greeting }]
      appendMessage(greeting, 'ai-message', false)
      saveHistory()
      return
    }
    history.forEach((m) =>
      appendMessage(
        m.text,
        m.role === 'user' ? 'user-message' : 'ai-message',
        false
      )
    )
  }

  history = loadHistory()
  threadId = loadThread()
  renderHistory()

  const moveBtnIntoHeader = () => {
    if (animating || merged) return
    animating = true
    chatWidget.classList.add('is-open')
    chatWidget.setAttribute('aria-hidden', 'false')
    toggleBtn.classList.add('active')
    toggleBtn.setAttribute('aria-label', 'Закрыть чат')
    const header = chatWidget.querySelector('.chat-header')
    const btnRect = toggleBtn.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const btnCenterX = btnRect.left + btnRect.width / 2
    const btnCenterY = btnRect.top + btnRect.height / 2
    const targetX = headerRect.right - 20
    const targetY = headerRect.top + 20
    const dx = targetX - btnCenterX
    const dy = targetY - btnCenterY
    toggleBtn.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`
    const onEnd = () => {
      toggleBtn.removeEventListener('transitionend', onEnd)
      toggleBtn.classList.add('hidden')
      merged = true
      animating = false
      userInput.focus()
      saveOpenState(true)
    }
    toggleBtn.addEventListener('transitionend', onEnd, { once: true })
  }

  const bringBtnBack = () => {
    if (animating || !merged) return
    animating = true
    toggleBtn.classList.remove('hidden')
    void toggleBtn.offsetWidth
    toggleBtn.style.transform = ''
    const onEnd = () => {
      toggleBtn.removeEventListener('transitionend', onEnd)
      toggleBtn.classList.remove('active')
      toggleBtn.setAttribute('aria-label', 'Открыть чат')
      merged = false
      animating = false
      saveOpenState(false)
    }
    toggleBtn.addEventListener('transitionend', onEnd, { once: true })
  }
  if (loadOpenState()) {
    chatWidget.classList.add('is-open')
    chatWidget.setAttribute('aria-hidden', 'false')
    toggleBtn.classList.add('active')
    toggleBtn.setAttribute('aria-label', 'Закрыть чат')
    toggleBtn.classList.add('hidden')
    toggleBtn.style.transform = ''
    merged = true
    setTimeout(() => userInput.focus(), 0)
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (chatWidget.classList.contains('is-open')) {
      chatWidget.classList.remove('is-open')
      chatWidget.setAttribute('aria-hidden', 'true')
      bringBtnBack()
    } else {
      moveBtnIntoHeader()
    }
  })

  document.addEventListener('click', (e) => {
    if (
      chatWidget.classList.contains('is-open') &&
      !chatContainer.contains(e.target)
    ) {
      chatWidget.classList.remove('is-open')
      chatWidget.setAttribute('aria-hidden', 'true')
      bringBtnBack()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatWidget.classList.contains('is-open')) {
      chatWidget.classList.remove('is-open')
      chatWidget.setAttribute('aria-hidden', 'true')
      bringBtnBack()
    }
  })

  async function sendMessageToServer(message) {
    try {
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          threadId: threadId,
          userId: 'anonymous', // Можно добавить идентификатор пользователя если нужно
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Сохраняем threadId для последующих сообщений
      if (data.threadId && data.threadId !== threadId) {
        threadId = data.threadId
        saveThread(threadId)
      }

      return data.reply
    } catch (error) {
      console.error('Server error:', error)
      throw error
    }
  }

  const sendMessage = async () => {
    const userMessage = userInput.value.trim()
    if (!userMessage) return

    appendMessage(userMessage, 'user-message')
    userInput.value = ''

    const typingEl = showTyping('Ассистент печатает')

    try {
      const reply = await sendMessageToServer(userMessage)
      hideTyping(typingEl)
      appendMessage(reply, 'ai-message')
    } catch (e) {
      hideTyping(typingEl)
      console.error('Ошибка чата:', e)
      appendMessage(
        'Извините, сервис временно недоступен. Пожалуйста, попробуйте позже.',
        'ai-message'
      )
    }
  }

  sendBtn.addEventListener('click', sendMessage)
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  })
})
