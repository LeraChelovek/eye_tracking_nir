// js/components/form-manager.js

class FormManager {
    constructor(gazeRecorder) {
        this.gazeRecorder = gazeRecorder;
        this.forms = [
            { name: 'form1_small_without', file: 'form-small-without.html', fields: 4, autocomplete: false },
            { name: 'form2_small_with', file: 'form-small-with.html', fields: 4, autocomplete: true },
            { name: 'form3_medium_without', file: 'form-medium-without.html', fields: 10, autocomplete: false },
            { name: 'form4_medium_with', file: 'form-medium-with.html', fields: 10, autocomplete: true },
            { name: 'form5_large_without', file: 'form-large-without.html', fields: 20, autocomplete: false },
            { name: 'form6_large_with', file: 'form-large-with.html', fields: 20, autocomplete: true }
        ];
        this.currentFormIndex = 0;
        this.participantId = null;
    }
    
    setParticipantId(id) {
        this.participantId = id;
    }
    
    async loadForm(formFile) {
        const response = await fetch(`templates/${formFile}`);
        return response.text();
    }
    
    async renderForm(index) {
        if (index >= this.forms.length) {
            this.showThankYou();
            return;
        }
        
        const form = this.forms[index];
        this.currentFormIndex = index;
        this.currentForm = form;
        const html = await this.loadForm(form.file);
        
        document.getElementById('experimentContainer').innerHTML = html;
        
        this.startRecordingForForm(form, index);
        
        this.attachFormEvents(form, index);
        this.applyAutocompleteSettings(form);
        this.updateProgressBar(form);
    }
    
    startRecordingForForm(form, formIndex) {
    console.log('🔴 form-manager.startRecordingForForm', form.name, formIndex);
    
    this.gazeRecorder.startRecordingForForm(formIndex, form.name, {
        formName: form.name,
        formIndex: formIndex,
        autocomplete: form.autocomplete ? 'enabled' : 'disabled'
    });
}
    attachFormEvents(form, formIndex) {
        const submitBtn = document.getElementById('submitFormBtn');
        if (!submitBtn) return;
        
        const inputs = document.querySelectorAll('.form-input');
        
        const checkFormValid = () => {
            let allFilled = true;
            inputs.forEach(input => {
                if (input.type === 'select-one') {
                    if (!input.value || input.value === '') allFilled = false;
                } else {
                    if (!input.value.trim()) allFilled = false;
                }
            });
            submitBtn.disabled = !allFilled;
            return allFilled;
        };
        
        inputs.forEach(input => {
            input.addEventListener('input', checkFormValid);
            input.addEventListener('change', checkFormValid);
        });
        
        // При нажатии "Далее" - останавливаем запись и сохраняем данные
        submitBtn.addEventListener('click', () => {
            this.saveGazeDataForCurrentForm(form, formIndex);
            this.nextForm();
        });
        
        checkFormValid();
    }
    
    saveGazeDataForCurrentForm(form, formIndex) {
    const gazeData = this.gazeRecorder.stopRecordingForForm();
    
    console.log(`📊 Форма ${form.name}: собрано ${gazeData.length} точек`);
    
    if (gazeData.length > 0) {
        console.log(`   Первая точка: time=${gazeData[0].time_from_form_ms} мс`);
        console.log(`   Последняя точка: time=${gazeData[gazeData.length-1].time_from_form_ms} мс`);
    }
    
    if (gazeData.length === 0) {
        console.warn(`Нет данных взгляда для формы ${formIndex + 1}`);
        return;
    }
    
    this.exportGazeDataToCSV(gazeData, formIndex, form.name);
}
    
    exportGazeDataToCSV(gazeData, formIndex, formName) {
        const headers = [
            'participantId',
            'formIndex',
            'formName',
            'autocomplete',
            'time_from_form_ms',
            'time_from_form',
            'x',
            'y',
            'timestamp'
        ];
        
        const rows = gazeData.map(point => [
            this.participantId || 'unknown',
            point.formIndex,
            point.formName,
            point.autocomplete,
            point.time_from_form_ms,
            point.time_from_form,
            point.x,
            point.y,
            point.timestamp
        ].join(','));
        
        const csv = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gaze_form${formIndex + 1}_${this.participantId || 'unknown'}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`📥 Скачан файл: gaze_form${formIndex + 1}_${Date.now()}.csv (${gazeData.length} точек)`);
    }
    
      updateProgressBar(form) {
        const totalFields = form.fields;
        const totalSpan = document.getElementById('totalFields');
        const filledSpan = document.getElementById('filledFields');
        const progressFill = document.getElementById('progressFill');
        
        if (totalSpan) totalSpan.textContent = totalFields;
        
        // Функция обновления прогресса
        const updateProgress = () => {
            let filled = 0;
            
            // Считаем заполненные поля по ID
            if (form.name === 'form1_small_without' || form.name === 'form2_small_with') {
                const ids = ['lastName', 'firstName', 'patronymic', 'city'];
                if (form.name === 'form2_small_with') {
                    ids[0] = 'lastNameWith';
                    ids[1] = 'firstNameWith';
                    ids[2] = 'patronymicWith';
                    ids[3] = 'cityWith';
                }
                ids.forEach(id => {
                    const input = document.getElementById(id);
                    if (input && input.value && input.value.trim() !== '') filled++;
                });
            }
            else if (form.name === 'form3_medium_without' || form.name === 'form4_medium_with') {
                const ids = ['lastName', 'firstName', 'patronymic', 'city', 'birthDate', 'birthPlace', 'institute', 'course', 'specialty', 'discipline'];
                if (form.name === 'form4_medium_with') {
                    for (let i = 0; i < ids.length; i++) ids[i] = ids[i] + 'With';
                }
                ids.forEach(id => {
                    const input = document.getElementById(id);
                    if (input && input.value && input.value.trim() !== '') filled++;
                });
            }
            else if (form.name === 'form5_large_without' || form.name === 'form6_large_with') {
                const ids = ['lastName', 'firstName', 'patronymic', 'city', 'birthDate', 'birthPlace', 'institute', 'course', 'specialty', 'discipline', 'email', 'phone', 'educationForm', 'gender', 'educationLevel', 'admissionYear', 'graduationYear', 'groupNumber', 'citizenship', 'snils'];
                if (form.name === 'form6_large_with') {
                    for (let i = 0; i < ids.length; i++) ids[i] = ids[i] + 'With';
                }
                ids.forEach(id => {
                    const input = document.getElementById(id);
                    if (input && input.value && input.value.trim() !== '') filled++;
                });
            }
            
            if (filledSpan) filledSpan.textContent = filled;
            if (progressFill) {
                const percent = (filled / totalFields) * 100;
                progressFill.style.width = `${percent}%`;
            }
        };
        
        // Запускаем обновление при изменении полей
        const allInputs = document.querySelectorAll('input, select');
        allInputs.forEach(input => {
            input.addEventListener('input', updateProgress);
            input.addEventListener('change', updateProgress);
        });
        
        updateProgress();
    }
    

    applyAutocompleteSettings(form) {
        const container = document.querySelector('.participant-form');
        if (!container) return;
        
        if (form.autocomplete) {
            console.log(`✅ Форма ${form.name}: автозаполнение РАЗРЕШЕНО`);
        } else {
            console.log(`❌ Форма ${form.name}: автозаполнение ЗАПРЕЩЕНО`);
            
            const allInputs = container.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => {
                input.setAttribute('autocomplete', 'off');
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
                
                if (input.tagName === 'INPUT' && input.type !== 'select-one') {
                    input.setAttribute('readonly', 'readonly');
                    input.addEventListener('focus', function() {
                        this.removeAttribute('readonly');
                    });
                }
            });
        }
    }
    
    nextForm() {
        this.currentFormIndex++;
        
        if (this.currentFormIndex < this.forms.length) {
            this.renderForm(this.currentFormIndex);
        } else {
            this.showThankYou();
        }
    }
    
    async showThankYou() {
        const thankYouHtml = `
            <div class="container">
                <main class="card thank-you-card">
                    <div class="thank-you-icon">🎉</div>
                    <h1 class="thank-you-title">Спасибо за участие!</h1>
                    <div class="thank-you-message">
                        <p>Вы успешно прошли эксперимент.</p>
                        <p>Все данные сохранены.</p>
                    </div>
                    <button id="restartBtn" class="btn btn-primary">🔄 Новый участник</button>
                </main>
            </div>
        `;
        
        document.getElementById('experimentContainer').innerHTML = thankYouHtml;
        
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                location.reload();
            });
        }
    }
    
    async start(participantId) {
        this.participantId = participantId;
        await this.renderForm(0);
    }
}