async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    return response.json();
}

async function getCurrentWeek() {
    try {
        return await fetchJson('https://iis.bsuir.by/api/v1/schedule/current-week');
    } catch (error) {
        console.error('Error fetching current week:', error);
        return null;
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekNumber(currentWeek, diffDays) {
    let weekNumber = ((currentWeek - 1) + Math.floor(diffDays / 7)) % 4 + 1;
    return weekNumber <= 0 ? weekNumber + 4 : weekNumber;
}

function getStartOfWeek(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function calculateWeekDifference(startDate, endDate) {
    const diffTime = startDate - endDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

async function init() {
    const currentWeek = await getCurrentWeek();
    const weekDisplay = document.getElementById('weekDisplay');
    let weekNumber; // Объявляем переменную для хранения номера недели
    
    if (!currentWeek) {
        weekDisplay.textContent = 'Не удалось загрузить неделю';
        return;
    }

    const datePicker = document.getElementById('datePicker');
    const today = new Date();
    
    today.setHours(0, 0, 0, 0);
    datePicker.value = formatDate(today);
    
    // Сохраняем текущий номер недели в переменную
    weekNumber = currentWeek;
    updateWeekDisplay(weekNumber, weekDisplay);

    datePicker.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        selectedDate.setHours(0, 0, 0, 0);

        const startOfCurrentWeek = getStartOfWeek(new Date(today));
        const startOfSelectedWeek = getStartOfWeek(selectedDate);
        
        const diffDays = calculateWeekDifference(startOfSelectedWeek, startOfCurrentWeek);
        
        // Обновляем переменную weekNumber
        weekNumber = getWeekNumber(currentWeek, diffDays);
        
        updateWeekDisplay(weekNumber, weekDisplay);
        
        // Теперь weekNumber доступна для использования в других частях кода
        console.log('Текущий номер недели:', weekNumber);
    });
}

// Вспомогательная функция для обновления отображения
function updateWeekDisplay(weekNum, element) {
    element.textContent = `${weekNum}-я учебная неделя`;
}

// Запускаем приложение
init();

const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
        const IPEauditories = ["502-2 к.", "601-2 к.", "603-2 к.", "604-2 к.", "605-2 к.", "607-2 к.", "611-2 к.", "613-2 к.", "615-2 к."];

        async function fetchJson(url) {
            const response = await fetch(url);
            return response.json();
        }

        async function getTeacherInfo() {
            const teachers = await fetchJson('https://iis.bsuir.by/api/v1/employees/all');
            const teacherSchedules = {};

            const promises = teachers.map(async (teacher) => {
                try {
                    const schedule = await fetchJson(`https://iis.bsuir.by/api/v1/employees/schedule/${teacher.urlId}`);
                    teacherSchedules[teacher.urlId] = schedule;
                } catch (error) {
                    console.error(`${teacher.urlId} generated an exception:`, error);
                }
            });

            await Promise.all(promises);
            return { teachers, teacherSchedules };
        }

        function parseDate(dateStr) {
            return dateStr ? new Date(dateStr.split('.').reverse().join('-')) : null;
        }

        function addLessonToSchedule(schedule, lesson, teacher) {
            schedule[`${lesson.startLessonTime}—${lesson.endLessonTime}`] = `${lesson.subject} (${lesson.lessonTypeAbbrev}) ${teacher.fio}`;
        }

        function timeInRange(start, end, x) {
            return start <= x && x <= end;
        }

        async function requestDaily(aud, teachers, teacherSchedules, currentWeek, selectedDate, isPrevious = false) {
            const schedule = {};
            const dayName = dayNames[selectedDate.getDay()];

            for (const teacher of teachers) {
                const teacherSchedule = teacherSchedules[teacher.urlId] || {};
                const weekDaySchedule = isPrevious ? teacherSchedule.previousSchedules?.[dayName] || [] : teacherSchedule.schedules?.[dayName] || [];

                for (const lesson of weekDaySchedule) {
                    let weekNumbers = lesson?.weekNumber || [];
                    if (lesson && lesson.auditories && lesson.auditories.includes(aud) && currentWeek !== null && Array.isArray(weekNumbers) && weekNumbers.includes(currentWeek)) {
                        const start = parseDate(lesson.startLessonDate);
                        const end = parseDate(lesson.endLessonDate);
                        const lessonDate = parseDate(lesson.dateLesson);

                        if (start && end && timeInRange(start, end, selectedDate)) {
                            addLessonToSchedule(schedule, lesson, teacher);
                        } else if (lessonDate && selectedDate.toDateString() === lessonDate.toDateString()) {
                            addLessonToSchedule(schedule, lesson, teacher);
                        }
                    }
                }
            }
            return schedule;
        }

        function printDict(container, dict) {
            for (const [timeRange, details] of Object.entries(dict)) {
                const lessonDiv = document.createElement('div');
                lessonDiv.className = 'lesson';
                lessonDiv.innerText = `${timeRange} ————— ${details}`;
                container.appendChild(lessonDiv);
            }
        }

       async function printSchedulesIPE(selectedDate, currentWeek) {
    const { teachers, teacherSchedules } = await getTeacherInfo();
    const schedulesContainer = document.getElementById('schedules');
    schedulesContainer.innerHTML = ''; // Clear previous schedules

    for (const aud of IPEauditories) {
        const audContainer = document.createElement('div');
        audContainer.className = 'auditory';
        audContainer.innerText = `-------------------------${aud}-------------------------`;
        schedulesContainer.appendChild(audContainer);

        // Получаем текущее расписание
        const currentSchedule = await requestDaily(aud, teachers, teacherSchedules, currentWeek, selectedDate);
        // Получаем предыдущее расписание
        const previousSchedule = await requestDaily(aud, teachers, teacherSchedules, currentWeek, selectedDate, true);

        // Объединяем расписания
        const combinedSchedule = { ...currentSchedule, ...previousSchedule };

        // Сортируем расписание по времени
        const sortedSchedule = Object.keys(combinedSchedule).sort().reduce((obj, key) => {
            obj[key] = combinedSchedule[key];
            return obj;
        }, {});

        printDict(audContainer, sortedSchedule);
    }
}

       // В обработчике изменения даты
document.getElementById('datePicker').addEventListener('change', async (event) => {
    const selectedDate = new Date(event.target.value);
    document.getElementById('loading').style.display = 'block';
    try {
        const weekNumber = await getCurrentWeek(); // Получаем текущую неделю
        await printSchedulesIPE(selectedDate, weekNumber);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
});

// В инициализации
const initialDate = new Date();
document.getElementById('datePicker').valueAsDate = initialDate;
document.getElementById('loading').style.display = 'block';
(async () => {
    try {
        const weekNumber = await getCurrentWeek(); // Получаем текущую неделю
        await printSchedulesIPE(initialDate, weekNumber);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
})();

        function copyAndSend() {
            const textToCopy = document.getElementById('schedules').innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert('Текст скопирован!');
                const telegramLink = `tg://msg?text=${encodeURIComponent(textToCopy)}`;
                window.open(telegramLink, '_blank');
            }).catch(err => {
                console.error('Ошибка при копировании текста: ', err);
            });
        }