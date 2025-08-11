# Nextcloud Element Injector App


## Konfiguration

### Persönliche Einstellungen

1. Gehe zu `Einstellungen` → `Persönlich` → `Element Injector`
2. Konfiguriere deine Text-Muster und Templates
3. Speichere die Konfiguration

### Standard-Konfiguration

Die App kommt mit folgenden Standard-Templates:

| Text-Muster | Template | Beschreibung |
|-------------|----------|-------------|
| `_AN` | 📄 Angebot | Angebots-Badge |
| `_RE` | 💰 Rechnung | Rechnungs-Badge |
| `_LI` | 🚚 Lieferung | Lieferungs-Badge |
| `_MA` | ⚠️ Mahnung | Mahnungs-Badge |

### Template-Syntax

Templates verwenden HTML mit CSS-Klassen:

```html
<span class="badge badge-info">
    <i class="fas fa-file-invoice"></i> Angebot
</span>
```

## Anpassung

### Eigene Templates erstellen

```javascript
// Beispiel für ein Custom Template
{
    "text": "_CUSTOM",
    "template": "<span class=\"badge badge-purple\">🎨 Custom</span>",
    "className": "kat-custom",
    "enabled": true
}
```

### CSS-Anpassungen

Bearbeite `css/style.css` für eigene Styles:

```css
.badge-purple {
    background-color: #6f42c1;
    color: white;
}

.files-badge {
    margin-left: 8px;
    font-size: 11px;
}
```

## Entwicklung & Debugging

### Debug-Interface

In der Browser-Konsole verfügbar:

```javascript
// Statistiken anzeigen
InjectorDebug.getStats();

// Konfiguration neu laden
await InjectorDebug.reloadConfig();

// Alle injizierten Elemente entfernen
InjectorDebug.removeAllInjected();

// Manuelle Injection testen
InjectorDebug.testInjection();
```

### Logs überprüfen

```bash
# Nextcloud Logs
tail -f /path/to/nextcloud/data/nextcloud.log

# Apache/Nginx Logs
tail -f /var/log/apache2/error.log
tail -f /var/log/nginx/error.log
```

## Problembehandlung

### App wird nicht angezeigt

1. **Cache leeren:**
   ```bash
   sudo -u www-data php occ maintenance:mode --on
   sudo -u www-data php occ app:disable elementinjector
   sudo -u www-data php occ app:enable elementinjector
   sudo -u www-data php occ maintenance:mode --off
   ```

2. **Berechtigungen prüfen:**
   ```bash
   ls -la apps/elementinjector/
   chown -R www-data:www-data apps/elementinjector/
   ```

### JavaScript-Fehler

1. **Browser-Konsole öffnen** (F12)
2. **Network-Tab prüfen** auf 404-Fehler
3. **Console-Tab prüfen** auf JavaScript-Fehler

### API-Fehler

1. **CSRF-Token prüfen:**
   ```javascript
   console.log('CSRF Token:', OC.requestToken);
   ```

2. **Netzwerk-Requests prüfen:**
   ```bash
   # API-Endpunkt testen
   curl -X GET "https://your-nextcloud.com/apps/elementinjector/api/v1/config" \
        -H "requesttoken: YOUR_TOKEN" \
        --cookie "COOKIE_STRING"
   ```

## Mobile Unterstützung

Die App funktioniert auch auf mobilen Geräten:

```css
/* Responsive Design in css/style.css */
@media (max-width: 768px) {
    .elementinjector-config-item {
        flex-direction: column;
    }
    
    .config-row {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .config-template {
        width: 100%;
    }
}
```

## 🔄 Updates

### App-Update durchführen

1. **Backup erstellen:**
   ```bash
   cp -r apps/elementinjector apps/elementinjector.backup
   ```

2. **Neue Dateien kopieren**

3. **Cache leeren:**
   ```bash
   sudo -u www-data php occ maintenance:repair
   ```

### Konfiguration migrieren

```javascript
// Export der aktuellen Konfiguration
const config = InjectorDebug.getStats().targetConfigs;
localStorage.setItem('elementinjector-backup', JSON.stringify(config));

// Nach Update: Import
const backup = JSON.parse(localStorage.getItem('elementinjector-backup'));
await InjectorDebug.setConfig(backup);
```

## Erweiterte Features

### Batch-Konfiguration

```bash
# Mehrere Konfigurationen via Script setzen
cat > import_config.json << 'EOF'
[
  {"text": "_AN", "template": "📄 Angebot", "className": "kat-angebot", "enabled": true},
  {"text": "_RE", "template": "💰 Rechnung", "className": "kat-rechnung", "enabled": true}
]
EOF

# Via API importieren
curl -X POST "https://your-nextcloud.com/apps/elementinjector/api/v1/config" \
     -H "Content-Type: application/json" \
     -H "requesttoken: YOUR_TOKEN" \
     -d @import_config.json
```

### Integration mit anderen Apps

```php
// In einer anderen App: Konfiguration abrufen
$configController = \OC::$server->query(\OCA\ElementInjector\Controller\ConfigController::class);
$configs = $configController->getConfig();
```

## 📚 API-Dokumentation

### GET /apps/elementinjector/api/v1/config

Ruft die aktuelle Benutzer-Konfiguration ab.

**Response:**
```json
{
  "configs": [
    {
      "text": "_AN",
      "template": "<span class=\"badge badge-info\">Angebot</span>",
      "className": "kat-angebot",
      "enabled": true
    }
  ]
}
```

### POST /apps/elementinjector/api/v1/config

Speichert eine neue Konfiguration.

**Request:**
```json
{
  "configs": [
    {
      "text": "_CUSTOM",
      "template": "<span class=\"badge badge-primary\">Custom</span>",
      "className": "kat-custom",
      "enabled": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration saved successfully"
}
```
## 📄 Lizenz

Diese App steht unter der AGPL-3.0 Lizenz - siehe [LICENSE](LICENSE) für Details.


**Made with ❤️ for the Nextcloud Community**
