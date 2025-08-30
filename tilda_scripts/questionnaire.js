async function upsertUser(userData) {
    try {
        const response = await fetch("https://sb.ulc.by/functions/v1/questionnaireUser", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка при обновлении/добавлении пользователя: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка в upsertUser:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    if (!userData) {
        const tildaUser = getTildaUserData();
        if (!tildaUser || !tildaUser.data.login) return;
        userData = await getUserByEmail(tildaUser.data.login);
        if (!userData) return;
    }
    hideLoad();
    setTimeout(function() {
        const form = document.getElementById('form1143820691');
        if (!form) {
            console.error('Форма не найдена');
            return;
        }

        const formData = {
            user_id: userData?.id || null
        };

        function updateFormData() {
            try {
                // Текстовые поля
                formData.name = form.querySelector('input[name="name"]')?.value.trim() || null;
                formData.age = form.querySelector('input[name="age"]')?.value.trim() || null;
                formData.hobby = form.querySelector('textarea[name="hobby"]')?.value.trim() || null;
                formData.themes = form.querySelector('input[name="themes"]')?.value.trim() || null;
                
                // Радиокнопки
                formData.learning_purpose = form.querySelector('input[name="learning_purpose"]:checked')?.value || null;
                formData.user_interests = form.querySelector('input[name="user_interests"]:checked')?.value || null;
                
                console.log('Form data updated:', formData);
            } catch (error) {
                console.error('Ошибка обновления данных формы:', error);
            }
        }

        // Инициализация и подписка на изменения
        updateFormData();
        form.addEventListener('input', updateFormData);
        form.addEventListener('change', updateFormData);

        // Обработка успешной отправки формы в Tilda
        form.addEventListener('tildaform:aftersuccess', function() {
            updateFormData();
            
            // Дополнительная валидация
            if (!formData.name || !formData.themes) {
                console.warn('Обязательные поля не заполнены');
                return;
            }
            
            upsertUser(formData)
                .then(() => console.log('Данные успешно сохранены в Supabase'))
                .catch(e => console.error('Ошибка:', e));
        });

    }, 200); // Задержка для Tilda
});
