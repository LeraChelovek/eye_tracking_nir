// js/main.js - управление приложением

let gazeRecorder = null;
let formManager = null;

// DOM элементы главной страницы
const startBtn = document.getElementById('startBtn');
const participantId = document.getElementById('participantId');
const gender = document.getElementById('gender');
const age = document.getElementById('age');
const consent = document.getElementById('consentCheckbox');

// Контейнеры
const calibrationContainer = document.getElementById('calibrationContainer');
const experimentContainer = document.getElementById('experimentContainer');
const mainContainer = document.querySelector('.container');

// Валидация формы
function isFormValid() {
    const id = participantId?.value.trim();
    const genderValue = gender?.value;
    const ageValue = parseInt(age?.value);
    const consentChecked = consent?.checked;
    
    return id && id.length >= 1 &&
           genderValue && genderValue !== '' &&
           ageValue >= 18 && ageValue <= 100 &&
           consentChecked;
}

function toggleStartButton() {
    if (startBtn) startBtn.disabled = !isFormValid();
}

// Сохранение данных участника
function saveParticipantData() {
    const sessionId = `${participantId.value.trim()}_${Date.now()}`;
    const data = {
        participantId: participantId.value.trim(),
        gender: gender.value,
        age: parseInt(age.value),
        consent: consent.checked,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('participantData', JSON.stringify(data));
    gazeRecorder.setSessionId(sessionId);
    return data;
}

// Переключение на калибровку
async function switchToCalibration() {
    mainContainer.style.display = 'none';
    calibrationContainer.style.display = 'block';
    
    calibrationContainer.innerHTML = renderCalibration();
    
    await initCalibration(gazeRecorder, () => {
        switchToFormExperiment();
    });
}

// Переключение на эксперимент (универсальные формы)
function switchToFormExperiment() {
    calibrationContainer.style.display = 'none';
    experimentContainer.style.display = 'block';
    
    formManager = new FormManager(gazeRecorder);
    formManager.start();
}

// Обработчик кнопки "Начать эксперимент"
async function onStartClick() {
    if (!isFormValid()) return;
    
    saveParticipantData();
    await switchToCalibration();
}

// Инициализация
window.addEventListener('DOMContentLoaded', async () => {
    gazeRecorder = new GazeRecorder();  // ← создаём после загрузки страницы
    
    const inputs = [participantId, gender, age, consent];
    inputs.forEach(input => {
        if (input) input.addEventListener('input', toggleStartButton);
        if (input) input.addEventListener('change', toggleStartButton);
    });
    
    if (startBtn) startBtn.addEventListener('click', onStartClick);
    
    toggleStartButton();
});