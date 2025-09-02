 const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
        const IPEauditories = ["502-2 к.", "601-2 к.", "603-2 к.", "604-2 к.", "605-2 к.", "607-2 к.", "611-2 к.", "613-2 к.", "615-2 к."];

        // Глобальные переменные для хранения данных
        let currentWeekNumber = null;
        let teachersData = null;
        let teacherSchedulesData = null;

        async function fetchJson(url) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        }

        async function loadInitialData() {
            document.getElementById('loading').style.display = 'block';
            try {
                // Загружаем текущую неделю
                currentWeekNumber = await fetchJson('https://iis.bsuir.by/api/v1/schedule/current-week');
                
                // Загружаем данные преподавателей
                const teachers = await fetchJson('https://iis.bsuir.by/api/v1/employees/all');
                teachersData = teachers;
                
                // Загружаем расписания преподавателей
                teacherSchedulesData = {};
                const promises = teachers.map(async (teacher) => {
                    try {
                        const schedule = await fetchJson(`https://iis.bsuir.by/api/v1/employees/schedule/${teacher.urlId}`);
                        teacherSchedulesData[teacher.urlId] = schedule;
                    } catch (error) {
                        console.error(`Ошибка загрузки расписания для ${teacher.fio}:`, error);
                        teacherSchedulesData[teacher.urlId] = { schedules: {}, previousSchedules: {} };
                    }
                });
                
                await Promise.all(promises);
                
                // Устанавливаем текущую дату
                const today = new Date();
                //today.setHours(0, 0, 0, 0);
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                document.getElementById('datePicker').value = `${yyyy}-${mm}-${dd}`;
                
                // Обновляем отображение недели
                const dayName = dayNames[today.getDay()]; 
                document.getElementById('weekDisplay').textContent = `${today.toLocaleDateString()} (${dayName}), ${currentWeekNumber}-я учебная неделя 🗓️`;
                
                // Загружаем расписание для текущей даты
                await updateSchedule(today, currentWeekNumber);
            } catch (error) {
                console.error('Ошибка при загрузке данных:', error);
                alert('Произошла ошибка при загрузке данных');
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        }

       function calculateWeekNumber(selectedDate) {
    if (!currentWeekNumber) return null;
    
    const today = new Date();
    //today.setHours(0, 0, 0, 0);
    
    // Находим понедельник текущей недели
    const getMonday = (date) => {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Понедельник - первый день
        return new Date(date.setDate(diff));
    };
    
    const currentMonday = getMonday(new Date(today));
    const selectedMonday = getMonday(new Date(selectedDate));
    
    // Разница в неделях между выбранной датой и текущей неделей
    const diffTime = selectedMonday - currentMonday;
    const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
    
    // Вычисляем номер недели с учётом 4-недельного цикла
    let weekNumber = ((currentWeekNumber - 1) + diffWeeks) % 4 + 1;
    return weekNumber <= 0 ? weekNumber + 4 : weekNumber;
}

      function parseDate(dateStr) {
            if (!dateStr) return null;
    try {
        const parts = dateStr.split('.');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Месяцы 0-11
        const year = parseInt(parts[2], 10);
        
        return new Date(year, month, day);
    } catch (error) {
        console.error('Ошибка парсинга даты:', dateStr, error);
        return null;
    }
}

        function timeInRange(start, end, target) {
            return start <= target && target <= end;
        }

        async function getScheduleForAuditory(auditory, date, weekNumber) {
            const schedule = {};
            const dayName = dayNames[date.getDay()];
            
            if (!teachersData || !teacherSchedulesData) return schedule;

            for (const teacher of teachersData) {
                const teacherSchedule = teacherSchedulesData[teacher.urlId] || {};
                
                // Проверяем оба расписания (текущее и предыдущее)
                for (const scheduleType of ['schedules', 'previousSchedules']) {
                    const daySchedule = teacherSchedule[scheduleType]?.[dayName] || [];
                    
                    for (const lesson of daySchedule) {
                        const weekNumbers = lesson?.weekNumber || [];
                        
                        if (lesson.auditories && lesson.auditories.includes(auditory) && 
                            Array.isArray(weekNumbers) && weekNumbers.includes(weekNumber)) {
                            
                            const startDate = parseDate(lesson.startLessonDate);
                            const endDate = parseDate(lesson.endLessonDate);
                            const lessonDate = parseDate(lesson.dateLesson);
                            
                            if ((startDate && endDate && timeInRange(startDate, endDate, date)) || 
                                (lessonDate && date.toDateString() === lessonDate.toDateString())) {
                                
                                const timeRange = `${lesson.startLessonTime}—${lesson.endLessonTime}`;
                                schedule[timeRange] = `${lesson.subject} (${lesson.lessonTypeAbbrev}) ${teacher.fio} ${lesson.studentGroups?.map(g => `гр. ${g.name}`).join(', ') || 'нет группы'}`;
                            }
                        }
                    }
                }
            }
            
            return schedule;
        }

        async function updateSchedule(date, weekNumber) {
    if (!weekNumber) {
        console.error('Не удалось определить номер недели');
        return;
    }

    document.getElementById('loading').style.display = 'block';
    try {
        const schedulesContainer = document.getElementById('schedules');
        schedulesContainer.innerHTML = '';
        
        const promises = IPEauditories.map(async (auditory) => {
            const schedule = await getScheduleForAuditory(auditory, date, weekNumber);
            return { auditory, schedule };
        });
        
        const results = await Promise.all(promises);
        
        for (const result of results) {
            const audContainer = document.createElement('div');
            audContainer.className = 'auditory';
            audContainer.innerHTML = `———<strong>${result.auditory}</strong>———`;
            schedulesContainer.appendChild(audContainer);
            
            const sortedTimes = Object.keys(result.schedule).sort();
            for (const time of sortedTimes) {
                const lessonDiv = document.createElement('div');
                lessonDiv.className = 'lesson';
                
                // Получаем текст занятия
                const lessonText = result.schedule[time];
                
                // Заменяем номера групп на кликабельные ссылки
                const textWithLinks = lessonText.replace(
                    /гр\. (\d+)/g, 
                    '<a href="https://iis.bsuir.by/schedule/$1" target="_blank" class="group-link">гр. $1</a>'
                );
                
                lessonDiv.innerHTML = `${time} —— ${textWithLinks}`;
                audContainer.appendChild(lessonDiv);
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении расписания:', error);
        alert('Произошла ошибка при загрузке расписания');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

       function copyAndSend() {
    // Получаем текст из weekDisplay
    const weekDisplayText = document.getElementById('weekDisplay').innerText;
    
    // Получаем текст из schedules
    const schedulesText = document.getElementById('schedules').innerText;
    
    // Объединяем с отступом (два переноса строки между ними)
    const textToCopy = `${weekDisplayText}\n\n${schedulesText}`;
    
    // Копируем в буфер обмена
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Текст скопирован!');
        
        // Отправляем в Telegram (если нужно)
        const telegramLink = `tg://msg?text=${encodeURIComponent(textToCopy)}`;
        window.open(telegramLink, '_blank');
    }).catch(err => {
        console.error('Ошибка при копировании текста: ', err);
        alert('Не удалось скопировать текст');
    });
}

        // Инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', () => {
            loadInitialData();
            
            // Обработчик изменения даты
            document.getElementById('datePicker').addEventListener('change', async (e) => {
                const selectedDate = new Date(e.target.value);
                selectedDate.setHours(0, 0, 0, 0);
                
                const weekNumber = calculateWeekNumber(selectedDate);
                const dayName = dayNames[selectedDate.getDay()]; 
                document.getElementById('weekDisplay').textContent = `${selectedDate.toLocaleDateString()} (${dayName}), ${weekNumber}-я учебная неделя 🗓️`;
                
                await updateSchedule(selectedDate, weekNumber);
            });
        });
