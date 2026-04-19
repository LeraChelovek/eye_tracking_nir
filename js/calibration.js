// js/calibration.js

const TOTAL_POINTS = 16;
const CLICKS_PER_POINT = 5;
let calibrationPoints = [];
let calibrationCompletedCount = 0;
let calibrationWebgazerReady = false;
let onCalibrationCompleteCallback = null;
let isCalibrationComplete = false;

function renderCalibration() {
    return `
        <div class="calibration-container">
            <div class="calibration-grid" id="calibrationGrid"></div>
            <div class="calibration-buttons">
                <button id="resetCalibrationBtn" class="calib-btn">Сброс</button>
                <button id="toFormBtn" class="calib-btn" disabled>Далее</button>
            </div>
            <div id="calibrationStatus" class="status">⏳ Запуск камеры...</div>
        </div>
    `;
}

async function initCalibration(gazeRecorder, onComplete) {
    onCalibrationCompleteCallback = onComplete;
    
    const grid = document.getElementById('calibrationGrid');
    const resetBtn = document.getElementById('resetCalibrationBtn');
    const toFormBtn = document.getElementById('toFormBtn');
    const statusDiv = document.getElementById('calibrationStatus');
    
    function createPoints() {
        grid.innerHTML = '';
        calibrationPoints = [];
        calibrationCompletedCount = 0;
        isCalibrationComplete = false;
        toFormBtn.disabled = true;
        
        for (let i = 0; i < TOTAL_POINTS; i++) {
            const dot = document.createElement('div');
            dot.className = 'calibration-point';
            dot.setAttribute('data-id', i);
            dot.setAttribute('data-state', '0');
            dot.onclick = () => onPointClick(i);
            grid.appendChild(dot);
            calibrationPoints.push({ id: i, element: dot, clicks: 0 });
        }
    }
    
    function checkAllPointsCompleted() {
        const allCompleted = calibrationPoints.every(p => p.clicks === CLICKS_PER_POINT);
        
        if (allCompleted && !isCalibrationComplete) {
            isCalibrationComplete = true;
            toFormBtn.disabled = false;  // ТОЛЬКО АКТИВИРУЕМ КНОПКУ, НЕ ПЕРЕХОДИМ
            statusDiv.innerText = '✅ Калибровка завершена! Нажмите "Далее"';
        }
        return allCompleted;
    }
    
    async function onPointClick(id) {
        // Защита: если калибровка завершена, не обрабатываем клики
        if (isCalibrationComplete) return;
        
        const point = calibrationPoints[id];
        if (point.clicks >= CLICKS_PER_POINT) return;
        if (!calibrationWebgazerReady) return;
        
        // Увеличиваем счётчик и меняем цвет
        point.clicks++;
        point.element.setAttribute('data-state', point.clicks);
        
        // Получаем предсказание и записываем калибровку
        const pred = await webgazer.getCurrentPrediction();
        
        if (pred) {
            const rect = point.element.getBoundingClientRect();
            const targetX = rect.left + rect.width / 2;
            const targetY = rect.top + rect.height / 2;
            webgazer.recordScreenPosition(targetX, targetY, 'click');
        }
        
        // Проверяем, завершена ли ВСЯ калибровка (просто активируем кнопку)
        checkAllPointsCompleted();
        
        // Обновляем статус (общий прогресс)
        const totalClicks = calibrationPoints.reduce((sum, p) => sum + p.clicks, 0);
        const totalNeeded = TOTAL_POINTS * CLICKS_PER_POINT;
        statusDiv.innerText = `🎯 ${totalClicks}/${totalNeeded}`;
    }
    
    function reset() {
        if (!confirm('Сбросить калибровку?')) return;
        
        calibrationCompletedCount = 0;
        isCalibrationComplete = false;
        calibrationPoints.forEach(p => {
            p.clicks = 0;
            p.element.setAttribute('data-state', '0');
        });
        
        webgazer.clearData();
        toFormBtn.disabled = true;
        statusDiv.innerText = '🔄 Сброшено';
        
        // Пересоздаём точки
        createPoints();
    }
    
    async function startWebGazer() {
        statusDiv.innerText = '🟡 Запуск камеры...';
        
        webgazer.showVideo(true)
            .showPredictionPoints(true)
            .applyKalmanFilter(true);
        
        await gazeRecorder.init();
        calibrationWebgazerReady = true;
        createPoints();
        
        const totalNeeded = TOTAL_POINTS * CLICKS_PER_POINT;
        statusDiv.innerText = `🎯 0/${totalNeeded}`;
    }
    
    // Кнопка Сброс
    resetBtn.addEventListener('click', reset);
    
    // Кнопка Далее - ТОЛЬКО РУЧНОЕ НАЖАТИЕ, никакого автоматического перехода!
    toFormBtn.addEventListener('click', () => {
        // Проверяем, что калибровка действительно завершена
        const allCompleted = calibrationPoints.every(p => p.clicks === CLICKS_PER_POINT);
        
        if (allCompleted && isCalibrationComplete && onCalibrationCompleteCallback) {
            console.log('✅ Ручной переход к эксперименту');
            onCalibrationCompleteCallback();
        } else {
            // Если по какой-то причине кнопка активна, но калибровка не завершена - блокируем
            toFormBtn.disabled = true;
            statusDiv.innerText = '⚠️ Завершите калибровку!';
        }
    });
    
    await startWebGazer();
}