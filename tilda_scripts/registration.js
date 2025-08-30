// Конфигурация сервисов
const SERVICE_IDS = {
    TEACHER: 'ceb102beafca6ce5373c28122f42d000',
    BEGINNER: '2b20b1afea95b62bd357733173c63ba4',
    ELEMENTARY: 'fa80955beb27388e99e47876bb2c6c06'
};

// Универсальная функция создания скрытых полей сервисов
function createFormServices(serviceIds) {
    const fragment = document.createDocumentFragment();
    serviceIds.forEach(serviceId => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'formservices[]';
        input.value = serviceId;
        input.className = 'js-formaction-services';
        fragment.appendChild(input);
    });
    return fragment;
}

// Специфичные функции для разных ролей
function createFormServicesTeacher() {
    return createFormServices([
        SERVICE_IDS.TEACHER,
        SERVICE_IDS.ELEMENTARY,
        SERVICE_IDS.BEGINNER
    ]);
}

function createFormServicesStudent() {
    return createFormServices([
        SERVICE_IDS.ELEMENTARY,
        SERVICE_IDS.BEGINNER
    ]);
}

// Нормализация номера телефона
function normalizePhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}

// Функции проверки в 1С
async function checkStudentIn1C(phone) {
    try {
        const response = await fetch('https://sb.ulc.by/functions/v1/check-student', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: normalizePhoneNumber(phone) })
        });

        if (!response.ok) {
            throw new Error('Вы не найдены в нашей системе как студент. Обратитесь в службу поддержки.');
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка в checkStudentIn1C:', error);
        throw error;
    }
}

async function checkTeacherIn1C(email) {
    try {
        const response = await fetch('https://sb.ulc.by/functions/v1/check-teacher', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            throw new Error('Вы не найдены в нашей системе как преподаватель. Обратитесь в службу поддержки.');
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка в checkTeacherIn1C:', error);
        throw error;
    }
}

// Функции работы с Supabase
async function upsertUser(userData) {
    try {
        const result = await api.upsertUser(userData);
        
        if (!result.success) {
            throw new Error(result.error || 'Ошибка при обновлении/добавлении пользователя');
        }
        
        return result.data;
    } catch (error) {
        console.error('Ошибка в upsertUser:', error);
        throw error;
    }
}

async function upsertTeacher(userData) {
    try {
        const result = await api.upsertTeacher(userData);
        
        if (!result.success) {
            throw new Error(result.error || 'Ошибка при обновлении/добавлении преподавателя');
        }
        
        return result.data;
    } catch (error) {
        console.error('Ошибка в upsertTeacher:', error);
        throw error;
    }
}

// Обработка сохранения в Supabase
async function handleSupabaseSave(userData, isTeacher = false) {
    try {
        if (isTeacher) {
            await upsertTeacher(userData);
            console.log('Данные преподавателя сохранены в Supabase');
        } else {
            await upsertUser(userData);
            console.log('Данные пользователя сохранены в Supabase');
        }
    } catch (error) {
        console.error('Ошибка Supabase:', error);
        showError('Данные отправлены, но возникла проблема с их сохранением');
    }
}

// Функции отображения UI
function showError(message, form) {
    hideLoad();
    const oldErrorBox = form.querySelector('.t-form__errorbox');
    if (oldErrorBox) oldErrorBox.remove();
    
    const box = document.createElement('div');
    box.className = 't-form__errorbox';
    box.style.marginBottom = '20px';
    box.innerHTML = message;
    
    const inputsBox = form.querySelector('.t-form__inputsbox');
    if (inputsBox) {
        inputsBox.prepend(box);
    } else {
        form.prepend(box);
    }
    
    box.style.opacity = '0';
    setTimeout(() => {
        box.style.transition = 'opacity 0.3s ease';
        box.style.opacity = '1';
    }, 10);
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

// Основные функции обработки
async function processTeacherRegistration(form, email, teacherResponse) {
    const userData = {
        name: teacherResponse.teacher.name || 'Новый преподаватель',
        email: email,
        role: 'teacher'
    };
    
    // Добавляем сервисы для преподавателя
    form.insertBefore(createFormServicesTeacher(), form.firstChild);
    
    // Добавляем обработчик для сохранения в Supabase после успешной отправки
    form.addEventListener('tildaform:aftersuccess', () => {
        handleSupabaseSave(userData, true);
        hideLoad();
    }, { once: true });
    
    // Отправляем форму через Tilda API
    if (typeof Tilda != 'undefined' && Tilda.Form) {
        Tilda.Form.submit(form);
    } else {
        // Fallback: нативная отправка формы
        form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
}

async function processStudentRegistration(form, email, phone, studentResponse) {
    const userData = {
        name: studentResponse.name,
        email: email,
        phone: normalizePhoneNumber(phone),
        lesson_number: '0',
        role: 'student'
    };
    
    form.dataset.userType = 'student';
    
    // Добавляем сервисы для студента
    form.insertBefore(createFormServicesStudent(), form.firstChild);
    
    // Добавляем обработчик для сохранения в Supabase после успешной отправки
    form.addEventListener('tildaform:aftersuccess', () => {
        hideLoad();
        handleSupabaseSave(userData, false);
        
        // Дополнительное сообщение об успехе
        const successBox = form.querySelector('.js-successbox');
        if (successBox) {
            successBox.innerHTML += '<br>Данные сохранены в системе';
        }
    }, { once: true });
    
    // Отправляем форму через Tilda API
    if (typeof Tilda != 'undefined' && Tilda.Form) {
        Tilda.Form.submit(form);
    } else {
        // Fallback: нативная отправка формы
        form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
}

// Главная функция обработки отправки формы
async function handleFormSubmit(e) {
    if (!e.isTrusted) return;
    
    e.preventDefault();
    e.stopImmediatePropagation();
    
    const form = e.target.closest('form');
    const email = form.querySelector('input[name="email"]').value;
    const phoneInput = form.querySelector('input[name="phone"]');
    const phone = phoneInput ? normalizePhoneNumber(phoneInput.value) : null;
    const roleRadio = form.querySelector('input[name="role"]:checked');
    
    if (!roleRadio) {
        showError('Пожалуйста, выберите роль', form);
        return;
    }
    
    const role = roleRadio.value;

    try {
        showLoad();
        
        if (role === 'Студент') {
            if (!phone) {
                showError('Пожалуйста, укажите номер телефона', form);
                return;
            }
            
            const studentResponse = await checkStudentIn1C(phone);
            
            if (studentResponse.result) {
                await processStudentRegistration(form, email, phone, studentResponse);
            } else {
                throw new Error('Ученик не найден или не имеет статус "Учится"');
            }
        } 
        else if (role === 'Преподаватель') {
            if (!email) {
                showError('Пожалуйста, укажите email', form);
                return;
            }
            
            const teacherResponse = await checkTeacherIn1C(email);
            
            if (teacherResponse.result) {
                await processTeacherRegistration(form, email, teacherResponse);
            } else {
                throw new Error('Вы не найдены в системе как преподаватель');
            }
        }
        
    } catch (error) {
        hideLoad();
        console.error('Ошибка обработки формы:', error);
        showError(error.message || 'Произошла ошибка при регистрации', form);
    } 
}

// Инициализация
function initializeForm() {
    const form = document.getElementById('form1230275931');
    if (!form) return;

    const submitBtn = form.querySelector('.t-submit');
    if (submitBtn) {
        // Удаляем старые обработчики если есть
        submitBtn.removeEventListener('click', handleFormSubmit);
        // Добавляем новый обработчик
        submitBtn.addEventListener('click', handleFormSubmit, true);
    }
}

// Запуск инициализации
document.addEventListener('DOMContentLoaded', function() {
    hideLoad()
    setTimeout(initializeForm, 1000);
});
