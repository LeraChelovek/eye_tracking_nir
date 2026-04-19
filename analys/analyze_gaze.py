import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os
import glob
from scipy.ndimage import gaussian_filter
from datetime import datetime
from matplotlib.colors import LinearSegmentedColormap

class GazeAnalyzer:
    def __init__(self, data_folder='.'):
        self.data_folder = data_folder
        self.all_data = []
        self.form_names = {
            1: 'Малая (без авто)',
            2: 'Малая (с авто)',
            3: 'Средняя (без авто)',
            4: 'Средняя (с авто)',
            5: 'Большая (без авто)',
            6: 'Большая (с авто)'
        }
        self.form_order = ['Малая (без авто)', 'Малая (с авто)', 
                          'Средняя (без авто)', 'Средняя (с авто)',
                          'Большая (без авто)', 'Большая (с авто)']
        
    def load_all_csv_files(self):
        csv_files = sorted(glob.glob(os.path.join(self.data_folder, 'gaze_form*.csv')))
        
        if not csv_files:
            print("❌ CSV файлы не найдены!")
            return False
        
        print(f"✅ Найдено {len(csv_files)} CSV файлов")
        
        for file in csv_files:
            try:
                df = pd.read_csv(file, encoding='utf-8')
                import re
                match = re.search(r'gaze_form(\d+)', file)
                if match:
                    form_num = int(match.group(1))
                    df['form_num'] = form_num
                    df['form_name'] = self.form_names.get(form_num, f'form{form_num}')
                self.all_data.append(df)
                print(f"   - {os.path.basename(file)}: {len(df)} точек")
            except Exception as e:
                print(f"   ❌ Ошибка загрузки {file}: {e}")
        
        return len(self.all_data) > 0
    
    def calculate_fixations(self, df, max_velocity=100, min_duration=100):
        """
        Детекция фиксаций по скорости движения взгляда.
        
        Параметры:
        - max_velocity: максимальная скорость для фиксации (пикселей/сек)
        - min_duration: минимальная длительность фиксации (мс)
        
        Возвращает:
        - количество фиксаций
        - среднюю длительность фиксации
        - список позиций фиксаций
        """
        if len(df) < 3:
            return 0, 0, []
        
        # Вычисляем скорость между точками
        velocities = []
        for i in range(1, len(df)):
            dx = df['x'].iloc[i] - df['x'].iloc[i-1]
            dy = df['y'].iloc[i] - df['y'].iloc[i-1]
            dt = df['time_from_form_ms'].iloc[i] - df['time_from_form_ms'].iloc[i-1]
            if dt > 0:
                velocity = np.sqrt(dx**2 + dy**2) / (dt / 1000)  # пикселей/сек
                velocities.append(velocity)
            else:
                velocities.append(0)
        
        # Детекция фиксаций (низкая скорость = фиксация)
        is_fixation = [v < max_velocity for v in velocities]
        
        # Группировка последовательных фиксаций
        fixations = []
        start_idx = None
        for i, fix in enumerate(is_fixation):
            if fix and start_idx is None:
                start_idx = i
            elif not fix and start_idx is not None:
                duration = df['time_from_form_ms'].iloc[i] - df['time_from_form_ms'].iloc[start_idx]
                if duration >= min_duration:
                    # Координаты фиксации (среднее)
                    xs = df['x'].iloc[start_idx:i].mean()
                    ys = df['y'].iloc[start_idx:i].mean()
                    fixations.append({'x': xs, 'y': ys, 'duration': duration})
                start_idx = None
        
        # Проверка последней фиксации
        if start_idx is not None:
            duration = df['time_from_form_ms'].iloc[-1] - df['time_from_form_ms'].iloc[start_idx]
            if duration >= min_duration:
                xs = df['x'].iloc[start_idx:].mean()
                ys = df['y'].iloc[start_idx:].mean()
                fixations.append({'x': xs, 'y': ys, 'duration': duration})
        
        if len(fixations) == 0:
            return 0, 0, []
        
        avg_duration = sum(f['duration'] for f in fixations) / len(fixations)
        return len(fixations), avg_duration, fixations
    
    def create_transparent_heatmap(self, df, form_name, output_folder='heatmaps'):
        """Создание прозрачной тепловой карты"""
        if len(df) == 0:
            return None
        
        os.makedirs(output_folder, exist_ok=True)
        
        fig, ax = plt.subplots(figsize=(12, 8), facecolor='none')
        ax.set_facecolor('none')
        
        heatmap, xedges, yedges = np.histogram2d(
            df['x'], df['y'], bins=50, range=[[0, 1920], [0, 1080]]
        )
        heatmap_smoothed = gaussian_filter(heatmap, sigma=2)
        
        if heatmap_smoothed.max() > 0:
            heatmap_normalized = heatmap_smoothed / heatmap_smoothed.max()
        else:
            heatmap_normalized = heatmap_smoothed
        
        colors = [(1, 0, 0, 0), (1, 0, 0, 0.3), (1, 0.5, 0, 0.5), (1, 1, 0, 0.6), (0, 1, 0, 0.7)]
        cmap = LinearSegmentedColormap.from_list('custom_alpha', colors, N=100)
        
        ax.imshow(heatmap_normalized.T, origin='lower', extent=[0, 1920, 0, 1080],
                  aspect='auto', cmap=cmap, alpha=0.5)
        
        # Отмечаем центры фиксаций на тепловой карте (опционально)
        fixations_count, _, fixations = self.calculate_fixations(df)
        if fixations:
            fx = [f['x'] for f in fixations]
            fy = [f['y'] for f in fixations]
            ax.scatter(fx, fy, c='white', s=20, alpha=0.6, edgecolors='black', linewidth=0.5)
        
        ax.set_xticks([])
        ax.set_yticks([])
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_visible(False)
        ax.spines['left'].set_visible(False)
        
        filename = os.path.join(output_folder, f'heatmap_{form_name}.png')
        plt.savefig(filename, dpi=150, bbox_inches='tight', transparent=True, facecolor='none')
        print(f"   🔥 Сохранена: {filename} (фиксаций: {fixations_count})")
        plt.close()
        
        return filename
    
    def create_all_heatmaps(self):
        """Создание тепловых карт для всех форм"""
        print("\n" + "="*60)
        print("🔥 СОЗДАНИЕ ТЕПЛОВЫХ КАРТ")
        print("="*60)
        
        for df in self.all_data:
            form_name = df['form_name'].iloc[0]
            fixations_count, _, _ = self.calculate_fixations(df)
            print(f"\n   Форма: {form_name} (фиксаций: {fixations_count})")
            self.create_transparent_heatmap(df, form_name)
    
    def create_time_chart(self):
        """Создание графика времени заполнения"""
        print("\n" + "="*60)
        print("⏱️ ГРАФИК ВРЕМЕНИ ЗАПОЛНЕНИЯ")
        print("="*60)
        
        times = {}
        fixations_data = {}
        for df in self.all_data:
            form_name = df['form_name'].iloc[0]
            duration_ms = df['time_from_form_ms'].max() if len(df) > 0 else 0
            times[form_name] = duration_ms / 1000
            fixations_count, _, _ = self.calculate_fixations(df)
            fixations_data[form_name] = fixations_count
        
        time_values = [times.get(name, 0) for name in self.form_order]
        colors = ['#e74c3c', '#2ecc71', '#e74c3c', '#2ecc71', '#e74c3c', '#2ecc71']
        
        fig, ax = plt.subplots(figsize=(12, 6))
        bars = ax.bar(self.form_order, time_values, color=colors, alpha=0.7, edgecolor='black', linewidth=1)
        
        for bar, val in zip(bars, time_values):
            if val > 0:
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                       f'{val:.1f} сек', ha='center', va='bottom', fontweight='bold', fontsize=10)
        
        ax.set_ylabel('Время заполнения (секунды)', fontsize=12)
        ax.set_title('Сравнение времени заполнения форм', fontsize=14, fontweight='bold')
        ax.set_xticklabels(self.form_order, rotation=45, ha='right', fontsize=10)
        ax.grid(True, alpha=0.3, axis='y')
        
        from matplotlib.patches import Patch
        legend_elements = [Patch(facecolor='#e74c3c', alpha=0.7, label='Без автозаполнения'),
                          Patch(facecolor='#2ecc71', alpha=0.7, label='С автозаполнением')]
        ax.legend(handles=legend_elements, loc='upper left')
        
        plt.tight_layout()
        plt.savefig('time_comparison.png', dpi=150)
        print(f"\n   📊 Сохранён график: time_comparison.png")
        plt.close()
        
        # Вывод данных
        print("\n   📊 ДАННЫЕ ПО ФОРМАМ:")
        print("   " + "-"*60)
        for name in self.form_order:
            if times.get(name, 0) > 0:
                print(f"   {name}:")
                print(f"      Время: {times[name]:.1f} сек")
                print(f"      Фиксаций: {fixations_data.get(name, 0)}")
                print(f"      Точек взгляда: {len(self.all_data[self.form_order.index(name)]) if self.form_order.index(name) < len(self.all_data) else 0}")
        print("   " + "-"*60)
    
    def create_fixations_chart(self):
        """Создание графика количества фиксаций"""
        print("\n" + "="*60)
        print("👁️ ГРАФИК КОЛИЧЕСТВА ФИКСАЦИЙ")
        print("="*60)
        
        fixations_data = {}
        for df in self.all_data:
            form_name = df['form_name'].iloc[0]
            fixations_count, _, _ = self.calculate_fixations(df)
            fixations_data[form_name] = fixations_count
        
        fixations_values = [fixations_data.get(name, 0) for name in self.form_order]
        colors = ['#e74c3c', '#2ecc71', '#e74c3c', '#2ecc71', '#e74c3c', '#2ecc71']
        
        fig, ax = plt.subplots(figsize=(12, 6))
        bars = ax.bar(self.form_order, fixations_values, color=colors, alpha=0.7, edgecolor='black', linewidth=1)
        
        for bar, val in zip(bars, fixations_values):
            if val > 0:
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                       f'{val:.0f}', ha='center', va='bottom', fontweight='bold', fontsize=10)
        
        ax.set_ylabel('Количество фиксаций', fontsize=12)
        ax.set_title('Сравнение количества фиксаций взгляда', fontsize=14, fontweight='bold')
        ax.set_xticklabels(self.form_order, rotation=45, ha='right', fontsize=10)
        ax.grid(True, alpha=0.3, axis='y')
        
        from matplotlib.patches import Patch
        legend_elements = [Patch(facecolor='#e74c3c', alpha=0.7, label='Без автозаполнения'),
                          Patch(facecolor='#2ecc71', alpha=0.7, label='С автозаполнением')]
        ax.legend(handles=legend_elements, loc='upper left')
        
        plt.tight_layout()
        plt.savefig('fixations_comparison.png', dpi=150)
        print(f"\n   📊 Сохранён график: fixations_comparison.png")
        plt.close()
        
        # Вывод данных
        print("\n   👁️ КОЛИЧЕСТВО ФИКСАЦИЙ:")
        for name in self.form_order:
            if fixations_data.get(name, 0) > 0:
                print(f"      {name}: {fixations_data[name]} фиксаций")
    
    def create_grouped_time_chart(self):
        """Сравнение по группам (малые, средние, большие)"""
        print("\n" + "="*60)
        print("📊 ГРУППОВОЕ СРАВНЕНИЕ ВРЕМЕНИ")
        print("="*60)
        
        times = {}
        for df in self.all_data:
            form_name = df['form_name'].iloc[0]
            duration_ms = df['time_from_form_ms'].max() if len(df) > 0 else 0
            times[form_name] = duration_ms / 1000
        
        small_without = times.get('Малая (без авто)', 0)
        small_with = times.get('Малая (с авто)', 0)
        medium_without = times.get('Средняя (без авто)', 0)
        medium_with = times.get('Средняя (с авто)', 0)
        large_without = times.get('Большая (без авто)', 0)
        large_with = times.get('Большая (с авто)', 0)
        
        categories = ['Малые (4 поля)', 'Средние (10 полей)', 'Большие (20 полей)']
        without_auto = [small_without, medium_without, large_without]
        with_auto = [small_with, medium_with, large_with]
        
        fig, ax = plt.subplots(figsize=(10, 6))
        x = np.arange(len(categories))
        width = 0.35
        
        bars1 = ax.bar(x - width/2, without_auto, width, label='Без автозаполнения', color='#e74c3c', alpha=0.7)
        bars2 = ax.bar(x + width/2, with_auto, width, label='С автозаполнением', color='#2ecc71', alpha=0.7)
        
        for bar in bars1:
            if bar.get_height() > 0:
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                       f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=10)
        for bar in bars2:
            if bar.get_height() > 0:
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                       f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=10)
        
        ax.set_ylabel('Время заполнения (секунды)', fontsize=12)
        ax.set_title('Сравнение времени по группам форм', fontsize=14, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(categories, fontsize=11)
        ax.legend(fontsize=11)
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plt.savefig('time_comparison_by_group.png', dpi=150)
        print(f"\n   📊 Сохранён график: time_comparison_by_group.png")
        plt.close()
        
        # Вывод экономии
        print("\n   💰 ЭКОНОМИЯ ВРЕМЕНИ ПРИ АВТОЗАПОЛНЕНИИ:")
        if small_without > 0 and small_with > 0:
            save = small_without - small_with
            percent = (save / small_without) * 100
            print(f"      Малые формы: {save:.1f} сек ({percent:.1f}%)")
        if medium_without > 0 and medium_with > 0:
            save = medium_without - medium_with
            percent = (save / medium_without) * 100
            print(f"      Средние формы: {save:.1f} сек ({percent:.1f}%)")
        if large_without > 0 and large_with > 0:
            save = large_without - large_with
            percent = (save / large_without) * 100
            print(f"      Большие формы: {save:.1f} сек ({percent:.1f}%)")
    
    def run_full_analysis(self):
        """Запуск полного анализа"""
        print("\n" + "="*60)
        print("🔬 АНАЛИЗ ДАННЫХ АЙТРЕКИНГА")
        print("="*60)
        print(f"Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if not self.load_all_csv_files():
            return
        
        self.create_all_heatmaps()
        self.create_time_chart()
        self.create_fixations_chart()
        self.create_grouped_time_chart()
        
        print("\n" + "="*60)
        print("✅ АНАЛИЗ ЗАВЕРШЁН!")
        print("="*60)
        print("\nСозданные файлы:")
        print("  🔥 Тепловые карты: heatmaps/heatmap_*.png")
        print("  📊 График времени: time_comparison.png")
        print("  👁️ График фиксаций: fixations_comparison.png")
        print("  📊 Групповое сравнение: time_comparison_by_group.png")

if __name__ == "__main__":
    analyzer = GazeAnalyzer(data_folder='.')
    analyzer.run_full_analysis()