# Инструкции по деплою на сервер

## 1. Локальная подготовка

### Установка зависимостей
```bash
# Удалить node_modules и package-lock.json если есть проблемы
rm -rf node_modules package-lock.json

# Установить зависимости
npm install

# Проверить что все работает
npm start
```

### Сборка проекта
```bash
npm run build
```

## 2. Настройка сервера

### Установка необходимого ПО на сервере
```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Nginx
sudo apt install nginx -y

# Установить Node.js и npm (если нужно)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установить Certbot для SSL
sudo apt install certbot python3-certbot-nginx -y
```

### Настройка домена
1. Убедитесь, что домен `table.omnicomm-expert.kz` указывает на ваш сервер
2. Проверьте DNS записи: `nslookup table.omnicomm-expert.kz`

## 3. Деплой приложения

### Создание директории для приложения
```bash
sudo mkdir -p /var/www/table.omnicomm-expert.kz
sudo chown -R $USER:$USER /var/www/table.omnicomm-expert.kz
```

### Загрузка файлов
```bash
# Скопировать собранные файлы из build/ в /var/www/table.omnicomm-expert.kz/
cp -r build/* /var/www/table.omnicomm-expert.kz/
```

### Настройка Nginx
Создать конфигурационный файл:
```bash
sudo nano /etc/nginx/sites-available/table.omnicomm-expert.kz
```

Содержимое файла:
```nginx
server {
    listen 80;
    server_name table.omnicomm-expert.kz;
    root /var/www/table.omnicomm-expert.kz;
    index index.html;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Обработка React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### Активация сайта
```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/table.omnicomm-expert.kz /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

## 4. Настройка SSL сертификата

### Получение SSL сертификата
```bash
sudo certbot --nginx -d table.omnicomm-expert.kz
```

### Автоматическое обновление сертификата
```bash
# Проверить что автообновление работает
sudo certbot renew --dry-run

# Добавить в crontab для автоматического обновления
sudo crontab -e
# Добавить строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 5. Финальная настройка

### Проверка работы
```bash
# Проверить статус Nginx
sudo systemctl status nginx

# Проверить SSL сертификат
sudo certbot certificates

# Проверить доступность сайта
curl -I https://table.omnicomm-expert.kz
```

### Настройка файрвола
```bash
# Разрешить HTTP и HTTPS
sudo ufw allow 'Nginx Full'

# Включить файрвол
sudo ufw enable
```

## 6. Автоматизация деплоя

### Создание скрипта деплоя
Создать файл `deploy.sh`:
```bash
#!/bin/bash

echo "🚀 Начинаем деплой..."

# Сборка проекта
echo "📦 Собираем проект..."
npm run build

# Копирование файлов
echo "📁 Копируем файлы на сервер..."
rsync -avz --delete build/ user@your-server:/var/www/table.omnicomm-expert.kz/

# Перезапуск Nginx
echo "🔄 Перезапускаем Nginx..."
ssh user@your-server "sudo systemctl reload nginx"

echo "✅ Деплой завершен!"
```

### Сделать скрипт исполняемым
```bash
chmod +x deploy.sh
```

## 7. Мониторинг и логи

### Просмотр логов Nginx
```bash
# Логи доступа
sudo tail -f /var/log/nginx/access.log

# Логи ошибок
sudo tail -f /var/log/nginx/error.log
```

### Мониторинг SSL сертификата
```bash
# Проверить срок действия
sudo certbot certificates

# Настроить уведомления об истечении
# Можно использовать сервисы типа Let's Encrypt Expiry Bot
```

## 8. Резервное копирование

### Создание бэкапа
```bash
# Бэкап конфигурации Nginx
sudo tar -czf nginx-config-backup.tar.gz /etc/nginx/sites-available/table.omnicomm-expert.kz

# Бэкап файлов сайта
sudo tar -czf website-backup.tar.gz /var/www/table.omnicomm-expert.kz
```

## Полезные команды для отладки

```bash
# Проверить статус сервисов
sudo systemctl status nginx
sudo systemctl status certbot.timer

# Проверить порты
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Проверить SSL сертификат
openssl s_client -connect table.omnicomm-expert.kz:443 -servername table.omnicomm-expert.kz
``` 