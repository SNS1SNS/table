import React, { useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ComposedChart,
  Bar
} from 'recharts';
import html2canvas from 'html2canvas';
import DataUploader from './DataUploader';
import './ChartPage.css';

const { saveAs } = require('file-saver');

// Типы данных
interface CalibrationData {
  x: number;
  y: number;
  name: string;
}

interface RawData {
  x: number;
  y: number;
  name: string;
}

const ChartPage: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedChartType, setSelectedChartType] = useState<'line' | 'scatter' | 'composed'>('line');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Состояние для данных
  const [calibrationData, setCalibrationData] = useState<CalibrationData[]>([]);
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [calibrationDate, setCalibrationDate] = useState<string>('');
  const [volumeDivider, setVolumeDivider] = useState<number>(1);

  // Обработчики для загрузки данных
  const handleCalibrationDataChange = (data: CalibrationData[], date: string, divider: number) => {
    setCalibrationData(data);
    setCalibrationDate(date);
    setVolumeDivider(divider);
  };

  const handleRawDataChange = (data: RawData[]) => {
    setRawData(data);
  };

  // Функция для преобразования кода датчика в литры
  const convertSensorCodeToLiters = (sensorCode: number): number => {
    if (calibrationData.length === 0) return sensorCode;
    
    // Находим ближайшие точки калибровки
    const sortedCalibration = [...calibrationData].sort((a, b) => a.x - b.x);
    
    // Если код меньше минимального
    if (sensorCode <= sortedCalibration[0].x) {
      return sortedCalibration[0].y;
    }
    
    // Если код больше максимального
    if (sensorCode >= sortedCalibration[sortedCalibration.length - 1].x) {
      return sortedCalibration[sortedCalibration.length - 1].y;
    }
    
    // Находим две ближайшие точки для интерполяции
    let lowerPoint = sortedCalibration[0];
    let upperPoint = sortedCalibration[sortedCalibration.length - 1];
    
    for (let i = 0; i < sortedCalibration.length - 1; i++) {
      if (sensorCode >= sortedCalibration[i].x && sensorCode <= sortedCalibration[i + 1].x) {
        lowerPoint = sortedCalibration[i];
        upperPoint = sortedCalibration[i + 1];
        break;
      }
    }
    
    // Линейная интерполяция
    const ratio = (sensorCode - lowerPoint.x) / (upperPoint.x - lowerPoint.x);
    return lowerPoint.y + ratio * (upperPoint.y - lowerPoint.y);
  };

  // Функция для преобразования даты в числовой формат
  const parseDateTime = (dateTimeStr: string): number => {
    // Парсим дату в формате "DD.MM.YYYY HH:MM:SS"
    const parts = dateTimeStr.trim().split(' ');
    if (parts.length !== 2) {
      throw new Error(`Неверный формат даты: ${dateTimeStr}`);
    }
    
    const datePart = parts[0]; // "DD.MM.YYYY"
    const timePart = parts[1]; // "HH:MM:SS"
    
    const dateParts = datePart.split('.');
    const timeParts = timePart.split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 3) {
      throw new Error(`Неверный формат даты: ${dateTimeStr}`);
    }
    
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Месяцы в JS начинаются с 0
    const year = parseInt(dateParts[2]);
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    const seconds = parseInt(timeParts[2]);
    
    const date = new Date(year, month, day, hours, minutes, seconds);
    return date.getTime();
  };

  // Функция для форматирования даты для отображения
  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}, ${hours}:${minutes}`;
  };

  // Преобразуем сырые данные с датой в числовой формат
  const rawDataWithTimestamp = rawData.map(item => {
    try {
      return {
        x: parseDateTime(item.name), // Время в миллисекундах
        y: convertSensorCodeToLiters(item.y), // Объем в литрах
        originalName: item.name // Сохраняем оригинальное имя для tooltip
      };
    } catch (error) {
      console.warn(`Ошибка парсинга даты для записи: ${item.name}`, error);
      return null;
    }
  }).filter(item => item !== null) as Array<{
    x: number;
    y: number;
    originalName: string;
  }>;

  // Функция для сохранения графика как изображение
  const saveChartAsImage = async () => {
    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true
        });
        
        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, `chart-${selectedChartType}-${new Date().toISOString().slice(0, 10)}.png`);
          }
        });
      } catch (error) {
        console.error('Ошибка при сохранении графика:', error);
        alert('Ошибка при сохранении графика');
      }
    }
  };

  // Функция для экспорта данных в CSV
  const exportToCSV = () => {
    const dividerInfo = volumeDivider !== 1 ? ` (делитель: ${volumeDivider})` : '';
    const csvContent = [
      `Тип,Дата/Время,Код датчика,Объем (л)${dividerInfo}`,
      ...calibrationData.map(d => `Калибровка,${calibrationDate || 'Неизвестно'},${d.x},${d.y}`),
      ...rawDataWithTimestamp.map(d => `Измерение,${d.originalName},${rawData.find(r => r.name === d.originalName)?.y || 0},${d.y.toFixed(1)}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `fuel-data-export-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Компонент для отображения статистики
  const StatisticsPanel = () => {
    if (calibrationData.length === 0 && rawData.length === 0) {
      return (
        <div className="statistics-panel">
          <h3>Статистика датчика топлива</h3>
          <div className="stat-item">
            <span>Загрузите данные для отображения статистики</span>
          </div>
        </div>
      );
    }

    const calibrationAvg = calibrationData.length > 0 
      ? calibrationData.reduce((sum, d) => sum + d.y, 0) / calibrationData.length 
      : 0;
    
    const rawAvgInLiters = rawDataWithTimestamp.length > 0 
      ? rawDataWithTimestamp.reduce((sum: number, d: any) => sum + d.y, 0) / rawDataWithTimestamp.length 
      : 0;

    // Находим ближайшие калибровочные точки для сырых данных
    const findClosestCalibration = (sensorCode: number) => {
      if (calibrationData.length === 0) return { x: 0, y: 0 };
      return calibrationData.reduce((closest, cal) => {
        return Math.abs(cal.x - sensorCode) < Math.abs(closest.x - sensorCode) ? cal : closest;
      });
    };

    const rawWithCalibration = rawData.map(raw => {
      const closest = findClosestCalibration(raw.y);
      const rawInLiters = convertSensorCodeToLiters(raw.y);
      return {
        raw: raw.y,
        rawInLiters: rawInLiters,
        calibration: closest.y,
        deviation: Math.abs(rawInLiters - closest.y)
      };
    });

    const avgDeviation = rawWithCalibration.length > 0 
      ? rawWithCalibration.reduce((sum, item) => sum + item.deviation, 0) / rawWithCalibration.length 
      : 0;

    const maxDeviation = rawWithCalibration.length > 0 
      ? Math.max(...rawWithCalibration.map(item => item.deviation))
      : 0;

    return (
      <div className="statistics-panel">
        <h3>Статистика датчика топлива</h3>
        <div className="stat-item">
          <span>Средний объем по калибровке:</span>
          <span>{calibrationAvg.toFixed(1)} л</span>
        </div>
        <div className="stat-item">
          <span>Средний объем измерений:</span>
          <span>{rawAvgInLiters.toFixed(1)} л</span>
        </div>
        <div className="stat-item">
          <span>Макс. отклонение объема:</span>
          <span>{maxDeviation.toFixed(1)} л</span>
        </div>
        <div className="stat-item">
          <span>Среднее отклонение:</span>
          <span>{avgDeviation.toFixed(1)} л</span>
        </div>
        <div className="stat-item">
          <span>Количество измерений:</span>
          <span>{rawData.length}</span>
        </div>
        <div className="stat-item">
          <span>Калибровочных точек:</span>
          <span>{calibrationData.length}</span>
        </div>
      </div>
    );
  };

  // Рендер графика в зависимости от выбранного типа
  const renderChart = () => {
    if (calibrationData.length === 0 && rawData.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          color: '#666',
          fontSize: '18px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
            <div>Загрузите данные для отображения графика</div>
            <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.7 }}>
              Используйте кнопки загрузки выше
            </div>
          </div>
        </div>
      );
    }

    const commonProps = {
      width: 1400,
      height: 800,
      data: rawDataWithTimestamp,
      margin: { top: 30, right: 40, left: 80, bottom: 60 }
    };

    switch (selectedChartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey="x" 
              name="Время" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDateTime}
            />
            <YAxis name="Объем топлива (л)" />
            <Tooltip 
              formatter={(value, name) => [
                `${value} л`, 
                'Объем топлива'
              ]}
              labelFormatter={(label) => {
                const date = new Date(parseInt(label));
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const seconds = date.getSeconds().toString().padStart(2, '0');
                return `${day}.${month}, ${hours}:${minutes}:${seconds}`;
              }}
            />
            {showLegend && <Legend />}
            {rawDataWithTimestamp.length > 0 && (
              <Line 
                type="monotone" 
                dataKey="y" 
                stroke="#82ca9d" 
                strokeWidth={3}
                dot={false}
                name="Объем топлива"
              />
            )}
          </LineChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey="x" 
              name="Время" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDateTime}
            />
            <YAxis name="Объем топлива (л)" />
            <Tooltip 
              formatter={(value, name) => [
                `${value} л`, 
                'Объем топлива'
              ]}
              labelFormatter={(label) => {
                const date = new Date(parseInt(label));
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const seconds = date.getSeconds().toString().padStart(2, '0');
                return `${day}.${month}, ${hours}:${minutes}:${seconds}`;
              }}
            />
            {showLegend && <Legend />}
            {rawDataWithTimestamp.length > 0 && (
              <Scatter 
                dataKey="y" 
                fill="#82ca9d" 
                name="Объем топлива"
              />
            )}
          </ScatterChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey="x" 
              name="Время" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDateTime}
            />
            <YAxis name="Объем топлива (л)" />
            <Tooltip 
              formatter={(value, name) => [
                `${value} л`, 
                'Объем топлива'
              ]}
              labelFormatter={(label) => {
                const date = new Date(parseInt(label));
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const seconds = date.getSeconds().toString().padStart(2, '0');
                return `${day}.${month}, ${hours}:${minutes}:${seconds}`;
              }}
            />
            {showLegend && <Legend />}
            {rawDataWithTimestamp.length > 0 && (
              <Line 
                type="monotone" 
                dataKey="y" 
                stroke="#82ca9d" 
                strokeWidth={3}
                dot={false}
                name="Объем топлива"
              />
            )}
          </ComposedChart>
        );

      default:
        return <div>Неизвестный тип графика</div>;
    }
  };

  return (
    <div className="chart-page">
      <div className="header">
        <h1>Объем топлива по времени</h1>
        <p>
          Динамика изменения уровня топлива
          {calibrationDate && (
            <span style={{ display: 'block', fontSize: '0.9rem', opacity: 0.8, marginTop: '5px' }}>
              Дата калибровки: {calibrationDate}
            </span>
          )}
          {volumeDivider !== 1 && (
            <span style={{ display: 'block', fontSize: '0.9rem', opacity: 0.8, marginTop: '5px' }}>
              Применен делитель объема: {volumeDivider} (значения поделены на {volumeDivider})
            </span>
          )}
        </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Тип графика:</label>
          <select 
            value={selectedChartType} 
            onChange={(e) => setSelectedChartType(e.target.value as any)}
          >
            <option value="line">Линейный график</option>
            <option value="scatter">Точечный график</option>
            <option value="composed">Комбинированный</option>
          </select>
        </div>

        <div className="control-group">
          <label>
            <input 
              type="checkbox" 
              checked={showGrid} 
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Показать сетку
          </label>
        </div>

        <div className="control-group">
          <label>
            <input 
              type="checkbox" 
              checked={showLegend} 
              onChange={(e) => setShowLegend(e.target.checked)}
            />
            Показать легенду
          </label>
        </div>

        <div className="control-group">
          <button onClick={saveChartAsImage} className="btn btn-primary">
            📷 Сохранить график
          </button>
        </div>

        <div className="control-group">
          <button onClick={exportToCSV} className="btn btn-secondary">
            📊 Экспорт CSV
          </button>
        </div>

        <div className="control-group">
          <DataUploader 
            onCalibrationDataChange={handleCalibrationDataChange}
            onRawDataChange={handleRawDataChange}
          />
        </div>
      </div>

      <div className="chart-container" ref={chartRef}>
        <ResponsiveContainer width="100%" height={900}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <div className="data-panels">
        <div className="data-panel">
          <h3>Тарировочная таблица</h3>
          <div className="data-table">
            {calibrationData.length === 0 ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#666',
                fontSize: '14px'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>📋</div>
                Загрузите XML файл с тарировочной таблицей
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Код датчика</th>
                    <th>Объем (л){volumeDivider !== 1 && ` (÷${volumeDivider})`}</th>
                    <th>Название</th>
                  </tr>
                </thead>
                <tbody>
                  {calibrationData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.x}</td>
                      <td>{item.y}</td>
                      <td>{item.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="data-panel">
          <h3>Сырые данные</h3>
          <div className="data-table">
            {rawData.length === 0 ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#666',
                fontSize: '14px'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
                Загрузите CSV файл с сырыми данными
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>№ Измерения</th>
                    <th>Код датчика</th>
                    <th>Объем (л){volumeDivider !== 1 && ` (÷${volumeDivider})`}</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.x}</td>
                      <td>{item.y}</td>
                      <td>{convertSensorCodeToLiters(item.y).toFixed(1)} л</td>
                      <td>{item.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <StatisticsPanel />
      </div>
    </div>
  );
};

export default ChartPage; 