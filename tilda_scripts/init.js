// ========== Инициализация при загрузке страницы. Используется на страницах курса ученика ==========
if (document.URL.includes('/lk')) {
document.addEventListener('DOMContentLoaded', () => {
    showLoad();
    // Инициализация пользователя
    
    initUser();
    document.querySelectorAll('.uc-test').forEach((element, index) => {
        const h2 = element.querySelector('h2');
        
        if (h2) {
            if (h2.textContent.includes('Progress Part')) {
                const text = h2.textContent.trim();
                var className = 'uc-' + text.replace(/\s+/g, '-');
            } else {
                const text = h2.textContent.trim();
                var className = 'uc-' + text.replace(' ', '-').replace(' ', '');
            }
            element.classList.add(className);
        }
    });
    
    // Инициализация страницы с тестами (если это страница теста)
    if (document.querySelector('[class*="uc-"][class*="-Test"]')) {
        initTestPage();
    }
    
    // Обработчики для аудио плеера
    document.querySelectorAll('.SpeechText').forEach(group => {
        group.addEventListener('click', (e) => {
            e.preventDefault();
            const textElement = group.querySelector('.text .tn-atom');
            const iconElement = group.querySelector('.icon .tn-atom');
            if (textElement && iconElement) {
                speak(textElement.textContent, iconElement);
            }
        });
    });
    hideLoad();
});
} 
