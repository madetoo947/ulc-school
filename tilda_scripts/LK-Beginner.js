// Функция для показа результатов теста
async function showTestResultsModal(lessonId) {
    try {
        if (!userData) {
            const tildaUser = getTildaUserData();
            if (!tildaUser || !tildaUser.data.login) return;
            userData = await getUserByEmail(tildaUser.data.login);
            if (!userData) return;
        }
        
        // Нормализуем lessonId для прогресс-тестов
        if (lessonId === 'progress-test-part-1') lessonId = 'Part1';
        if (lessonId === 'progress-test-part-2') lessonId = 'Part2';
        
        const results = await getUserTestResults(userData.id, lessonId);
        if (results.length === 0) {
            alert('Результаты теста не найдены');
            return;
        }

        // Создаем модальное окно с результатами
        const modal = document.createElement('div');
        modal.className = 'test-results-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const modalContent = document.createElement('div');

        const summary = createTestResultsSummary(results);
        modalContent.appendChild(summary);
        modalContent.querySelector('h2').textContent = `Результаты теста ${lessonId}`;

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Закрыть';
        closeButton.style.cssText = `
            margin-top: 15px;
            padding: 16px 36px;
            background: #F34040;
            color: white;
            border: none;
            border-radius: 74px;
            cursor: pointer;
            font-size: 16px;
        `;
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.style.overflow = 'auto';
        });
        modalContent.appendChild(closeButton);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Ошибка при показе результатов:', error);
        alert('Произошла ошибка при загрузке результатов');
    }
}

function initResultsButtons(lesson_number) {
    var resultsBtns = document.querySelectorAll('[class*="results-button-"]');
    for (var i = 0; i < lesson_number; i++) {
        if (resultsBtns[i-1]) {
            resultsBtns[i-1].querySelector('.tn-atom').classList.add('active');
            const classList = resultsBtns[i-1].className.split(' ');
            const resultsClass = classList.find(cls => cls.startsWith('results-button-'));
            if (resultsClass) {
                const lessonId = resultsClass.replace('results-button-', '');
                resultsBtns[i-1].addEventListener('click', () => showTestResultsModal(lessonId));
            }   
        }
       
    }
}

async function getStugentNextLesson(number) {
  const res = await fetch("https://sb.ulc.by/functions/v1/student-next-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({phone: number})
  });
  return res.json();
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Убедимся, что userData загружена
        if (!userData) {
            const tildaUser = getTildaUserData();
            if (!tildaUser || !tildaUser.data.login) {
                console.error('Не удалось получить данные пользователя из Tilda');
                return;
            }
            userData = await getUserByEmail(tildaUser.data.login);
            if (!userData) {
                console.error('Пользователь не найден в базе данных');
                return;
            }
        }
        const nextLesson = await getStugentNextLesson(userData.phone)
        initResultsButtons(userData.level_progress[getCurrentLevelFromUrl()]);
    } catch (error) {
        console.error('Ошибка инициализации кнопок результатов:', error);
    }
});
