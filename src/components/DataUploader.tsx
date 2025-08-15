import React, { useState } from 'react';
import './DataUploader.css';

interface DataPoint {
  x: number;
  y: number;
  name: string;
}

interface DataUploaderProps {
  onCalibrationDataChange: (data: DataPoint[], calibrationDate: string, volumeDivider: number) => void;
  onRawDataChange: (data: DataPoint[]) => void;
}

const DataUploader = ({ 
  onCalibrationDataChange, 
  onRawDataChange 
}: DataUploaderProps) => {
  const [uploadStatus, setUploadStatus] = useState('');
  const [volumeDivider, setVolumeDivider] = useState<number>(1);
  const [lastXmlData, setLastXmlData] = useState<string>('');

  // Обработчик изменения делителя
  const handleDividerChange = (newDivider: number) => {
    setVolumeDivider(newDivider);
    
    // Если у нас есть загруженные XML данные, пересчитываем их
    if (lastXmlData) {
      try {
        const { data, calibrationDate } = parseCalibrationXML(lastXmlData);
        onCalibrationDataChange(data, calibrationDate, newDivider);
        setUploadStatus(`✅ Данные пересчитаны с делителем ${newDivider}`);
        setTimeout(() => setUploadStatus(''), 2000);
      } catch (error) {
        setUploadStatus(`❌ Ошибка пересчета: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        setTimeout(() => setUploadStatus(''), 3000);
      }
    }
  };

  // Парсер XML тарировочной таблицы
  const parseCalibrationXML = (xmlText: string): { data: DataPoint[], calibrationDate: string } => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Извлекаем дату калибровки
    const calibrationDateElement = xmlDoc.querySelector('calibrationDate');
    const calibrationDate = calibrationDateElement ? calibrationDateElement.textContent || '' : '';
    
    // Ищем все value элементы в sensor
    const valueElements = xmlDoc.querySelectorAll('sensor value');
    const calibrationData: DataPoint[] = [];
    
    valueElements.forEach((element, index) => {
      const code = element.getAttribute('code');
      const value = element.textContent;
      
      if (code && value) {
        const originalVolume = parseInt(value);
        const adjustedVolume = originalVolume / volumeDivider; // Делим на указанное число
        
        calibrationData.push({
          x: parseInt(code), // Код датчика (например, 289)
          y: adjustedVolume, // Объем в литрах с учетом делителя
          name: `Калибровка ${index + 1}`
        });
      }
    });
    
    return {
      data: calibrationData.sort((a, b) => a.x - b.x),
      calibrationDate
    };
  };

  // Парсер CSV сырых данных
  const parseRawDataCSV = (csvText: string): DataPoint[] => {
    const lines = csvText.trim().split('\n');
    
    // Проверяем, есть ли заголовок
    const firstLine = lines[0];
    const hasHeader = firstLine.includes(',') && (
      firstLine.toLowerCase().includes('time') || 
      firstLine.toLowerCase().includes('date') || 
      firstLine.toLowerCase().includes('время') || 
      firstLine.toLowerCase().includes('дата')
    );
    
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    return dataLines.map((line, index) => {
      const parts = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (parts.length < 2) {
        throw new Error(`Неверный формат строки ${index + 1}: ${line}`);
      }
      
      const dateTime = parts[0]; // Дата и время
      const sensorValue = parseFloat(parts[1]) || 0; // Код датчика
      
      return {
        x: index, // Индекс измерения
        y: sensorValue, // Код датчика (например, 2535)
        name: dateTime // Дата и время
      };
    }).filter(point => !isNaN(point.y));
  };

  const handleCalibrationUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('Загружаем тарировочную таблицу...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result as string;
        const { data, calibrationDate } = parseCalibrationXML(xmlText);
        
        if (data.length === 0) {
          throw new Error('Не удалось найти данные калибровки в XML файле');
        }
        
        onCalibrationDataChange(data, calibrationDate, volumeDivider);
        setUploadStatus(`✅ Тарировочная таблица загружена (${data.length} точек)`);
        setTimeout(() => setUploadStatus(''), 3000);
        setLastXmlData(xmlText); // Сохраняем XML для пересчета
      } catch (error) {
        setUploadStatus(`❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        setTimeout(() => setUploadStatus(''), 5000);
      }
    };
    
    reader.readAsText(file);
  };

  const handleRawDataUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('Загружаем сырые данные...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const data = parseRawDataCSV(csvText);
        
        if (data.length === 0) {
          throw new Error('Не удалось найти данные в CSV файле');
        }
        
        onRawDataChange(data);
        setUploadStatus(`✅ Сырые данные загружены (${data.length} точек)`);
        setTimeout(() => setUploadStatus(''), 3000);
      } catch (error) {
        setUploadStatus(`❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        setTimeout(() => setUploadStatus(''), 5000);
      }
    };
    
    reader.readAsText(file);
  };

  const downloadCalibrationTemplate = () => {
    const template = `<?xml version="1.0" encoding="UTF-8"?>
<vehicle>
  <sensor number="0">
    <value code="0">0</value>
    <value code="289">100</value>
    <value code="437">200</value>
    <value code="617">300</value>
    <value code="725">400</value>
    <value code="863">500</value>
    <value code="980">600</value>
    <value code="1134">700</value>
    <value code="1302">800</value>
    <value code="1445">900</value>
    <value code="1575">1000</value>
  </sensor>
</vehicle>`;
    
    const blob = new Blob([template], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calibration-template.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadRawDataTemplate = () => {
    const template = '28.06.2025 07:03:29,2535\n28.06.2025 07:05:29,2534\n28.06.2025 07:07:29,2535\n28.06.2025 07:09:29,2535';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw-data-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="data-uploader">
      <div className="upload-buttons">
        <div className="upload-section">
          <h4>Тарировочная таблица (XML)</h4>
          <div className="divider-input">
            <label htmlFor="volume-divider">Делитель объема:</label>
            <input
              type="number"
              id="volume-divider"
              value={volumeDivider}
              onChange={(e) => handleDividerChange(parseFloat(e.target.value) || 1)}
              min="0.1"
              step="0.1"
              placeholder="1"
              className="divider-field"
            />
            <span className="divider-help">(например: 10 для деления 100→10л, 200→20л. Можно изменить после загрузки)</span>
          </div>
          <input
            type="file"
            accept=".xml"
            onChange={handleCalibrationUpload}
            id="calibration-file"
            className="file-input"
          />
          <label htmlFor="calibration-file" className="file-label">
            📊 Выбрать XML файл
          </label>
          <button onClick={downloadCalibrationTemplate} className="btn btn-help">
            📋 Шаблон XML
          </button>
        </div>

        <div className="upload-section">
          <h4>Сырые данные (CSV)</h4>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleRawDataUpload}
            id="raw-file"
            className="file-input"
          />
          <label htmlFor="raw-file" className="file-label">
            📊 Выбрать CSV файл
          </label>
          <button onClick={downloadRawDataTemplate} className="btn btn-help">
            📋 Шаблон CSV
          </button>
        </div>

        <div className="upload-help">
          <p><strong>Формат XML:</strong> Тарировочная таблица с элементами &lt;value code="X"&gt;Y&lt;/value&gt;</p>
          <p><strong>Формат CSV:</strong> Дата Время,Код_датчика (например: 28.06.2025 07:03:29,2535)</p>
        </div>

        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.includes('❌') ? 'error' : 'success'}`}>
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUploader;