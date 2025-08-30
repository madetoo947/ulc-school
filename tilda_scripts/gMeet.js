async function getStugentNextLesson(number) {
  const res = await fetch("https://sb.ulc.by/functions/v1/student-next-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({phone: number})
  });
  return res.json();
}
// Функция для обработки даты и управления кнопкой
function updateLessonButton(serverData) {
    const button = document.querySelector('.video-lesson .tn-atom');
    if (!serverData || !serverData.nextLessonDate) {
        console.error('Неверные данные от сервера', serverData);
        button.style.display = 'none';
        return;
    }

    
    if (!button) return;

    // Парсим дату следующего урока
    const [datePart, timePart] = serverData.nextLessonDate.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hours, minutes, seconds] = timePart.split(':');
    const lessonDate = new Date(year, month - 1, day, hours, minutes, seconds);
    const now = new Date();
    // Вычисляем разницу во времени (в миллисекундах)
    const timeDiff = lessonDate - now;
    const fiveMinutes = 5 * 60 * 1000; // 5 минут в миллисекундах

    if (timeDiff > 0 && timeDiff <= fiveMinutes) {
        // До урока осталось 5 минут или меньше - активируем кнопку
        button.disabled = false;
        button.innerHTML = 'Присоединиться<br>к видеоуроку';
        button.style.backgroundColor = '#3c4af5';
        button.style.color = '#fff';
        button.href = userData.lesson_link;
        button.style.pointerEvents = 'auto';
        // Устанавливаем таймер для полной активации ровно в начало урока
        if (timeDiff > 0) {
            setTimeout(() => {
                button.innerHTML = 'Присоединиться<br>к видеоуроку';
                button.href = userData.lesson_link;
                button.style.pointerEvents = 'auto';
                button.disabled = false;
            }, timeDiff);
        }
    } else if (timeDiff > fiveMinutes) {
    // else if (false) {
        // До урока больше 5 минут - показываем дату и время
        button.disabled = true;
        const formattedDate = lessonDate.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        button.innerHTML = `Следующее занятие:<br>${formattedDate}`;
        button.style.backgroundColor = 'transparent';
        button.style.color = '#3c4af5';
        button.style.pointerEvents = 'none';
        // Устанавливаем таймер для проверки за 5 минут до урока
        setTimeout(updateLessonButton, timeDiff - fiveMinutes);
    } else {
        // Урок уже прошел или идет прямо сейчас
        button.disabled = false;
        button.innerHTML = 'Присоединиться<br>к видеоуроку';
        button.style.pointerEvents = 'auto';
        button.href = userData.lesson_link;
        button.style.backgroundColor = '#3c4af5';
        button.style.color = '#fff';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const button = document.querySelector('.video-lesson .tn-atom');
    try {
        // Убедимся, что userData загружена
        if (!userData) {
            button.style.display = 'none';
            const tildaUser = getTildaUserData();
            if (!tildaUser || !tildaUser.data.login) {
                hideLoad();
                console.error('Не удалось получить данные пользователя из Tilda');
                return;
            }
            userData = await getUserByEmail(tildaUser.data.login);
            if (!userData) {
                hideLoad();
                console.error('Пользователь не найден в базе данных');
                return;
            } else {
                button.style.display = 'block';
            }
        }
        const serverData = await getStugentNextLesson(userData.phone)
        // Первоначальное обновление кнопки
        updateLessonButton(serverData);
        
        // Проверяем каждую минуту на случай если страница остается открытой
        setInterval(() => updateLessonButton(serverData), 60000);
        hideLoad();
    } catch (error) {
        console.error('Ошибка инициализации кнопок результатов:', error);
    }
});
