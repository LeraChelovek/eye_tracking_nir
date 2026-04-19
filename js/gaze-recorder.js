// js/gaze-recorder.js - максимально простая версия

class GazeRecorder {
    constructor() {
        this.sessionId = null;
        this.webgazerReady = false;
        this.isRecordingForForm = false;
        this.currentFormData = [];
        this.formStartTime = null;
        this.intervalId = null;
    }
    
    setSessionId(id) {
        this.sessionId = id;
        console.log('Session ID:', id);
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            webgazer.setRegression('ridge')
                .showVideo(true)
                .showPredictionPoints(true)
                .applyKalmanFilter(true);
            
            webgazer.begin()
                .then(() => {
                    this.webgazerReady = true;
                    console.log('✅ WebGazer готов');
                    resolve();
                })
                .catch(err => {
                    console.error('❌ Ошибка WebGazer:', err);
                    reject(err);
                });
        });
    }
    
    startRecordingForForm(formIndex, formName, metadata) {
        console.log('🔴 startRecordingForForm вызван', {formIndex, formName, metadata});
        
        if (!this.webgazerReady) {
            console.log('⚠️ WebGazer не готов');
            return;
        }
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.isRecordingForForm = true;
        this.currentFormData = [];
        this.formStartTime = Date.now();
        
        console.log('🔴 Запуск интервала, startTime=', this.formStartTime);
        
        this.intervalId = setInterval(async () => {
            console.log('🔴 Интервал сработал!');
            
            if (!this.isRecordingForForm) {
                console.log('⚠️ Запись остановлена');
                return;
            }
            
            if (!this.webgazerReady) {
                console.log('⚠️ WebGazer не готов');
                return;
            }
            
            try {
                const pred = await webgazer.getCurrentPrediction();
                console.log('🔴 Предсказание:', pred);
                
                if (pred && pred.x !== null && pred.y !== null) {
                    const now = Date.now();
                    const elapsed = now - this.formStartTime;
                    
                    const point = {
                        formIndex: formIndex,
                        formName: formName,
                        autocomplete: metadata.autocomplete,
                        time_from_form_ms: elapsed,
                        time_from_form: (elapsed / 1000).toFixed(3) + 's',
                        x: Math.round(pred.x),
                        y: Math.round(pred.y),
                        timestamp: new Date().toISOString()
                    };
                    
                    this.currentFormData.push(point);
                    console.log(`✅ Точка ${this.currentFormData.length}: x=${point.x}, y=${point.y}, time=${elapsed}ms`);
                } else {
                    console.log('⚠️ Нет предсказания');
                }
            } catch(err) {
                console.error('❌ Ошибка:', err);
            }
        }, 100); // 100ms = 10Hz
        
        console.log('🔴 Интервал запущен, id=', this.intervalId);
    }
    
    stopRecordingForForm() {
        console.log('🔴 stopRecordingForForm вызван');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        const data = [...this.currentFormData];
        this.isRecordingForForm = false;
        this.currentFormData = [];
        
        console.log(`🔴 Собрано ${data.length} точек`);
        return data;
    }
    
    // Заглушки для остальных методов (если нужны)
    startSession(id) { this.setSessionId(id); }
    startTrial() { return true; }
    startRecording() {}
    stopRecording() {}
    endTrial() { return null; }
    saveToLocalStorage() {}
    exportCurrentSessionToCSV() {}
    getStats() { return { totalPoints: 0 }; }
}