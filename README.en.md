# NextCloud Element Injector App

## Configuration

### Personal Settings

1. Go to `Settings` → `Personal` → `Element Injector`
2. Configure your text patterns and templates
3. Save the configuration

### Default Configuration

The app comes with the following default templates:

| Text Pattern | Template | Description |
|--------------|----------|-------------|
| `_AN` | Offer | Offer badge |
| `_RE` | Invoice | Invoice badge |
| `_LI` | Delivery | Delivery badge |
| `_MA` | Reminder | Reminder badge |

### Template Syntax

Templates use HTML with CSS classes:

```html
<span class="badge badge-info">
    <i class="fas fa-file-invoice"></i> Offer
</span>
```

## Customization

### Creating Custom Templates

```javascript
// Example for a custom template
{
    "text": "_CUSTOM",
    "template": "<span class=\"badge badge-purple\">Custom</span>",
    "className": "kat-custom",
    "enabled": true
}
```

### CSS Customizations

Edit `css/style.css` for custom styles:

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

## Development & Debugging

### Debug Interface

Available in the browser console:

```javascript
// Show statistics
InjectorDebug.getStats();

// Reload configuration
await InjectorDebug.reloadConfig();

// Remove all injected elements
InjectorDebug.removeAllInjected();

// Test manual injection
InjectorDebug.testInjection();
```

### Check Logs

```bash
# NextCloud logs
tail -f /path/to/nextcloud/data/nextcloud.log

# Apache/Nginx logs
tail -f /var/log/apache2/error.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### App Not Displayed

1. **Clear cache:**
   ```bash
   sudo -u www-data php occ maintenance:mode --on
   sudo -u www-data php occ app:disable elementinjector
   sudo -u www-data php occ app:enable elementinjector
   sudo -u www-data php occ maintenance:mode --off
   ```

2. **Check permissions:**
   ```bash
   ls -la apps/elementinjector/
   chown -R www-data:www-data apps/elementinjector/
   ```

### JavaScript Errors

1. **Open browser console** (F12)
2. **Check Network tab** for 404 errors
3. **Check Console tab** for JavaScript errors

### API Errors

1. **Check CSRF token:**
   ```javascript
   console.log('CSRF Token:', OC.requestToken);
   ```

2. **Check network requests:**
   ```bash
   # Test API endpoint
   curl -X GET "https://your-nextcloud.com/apps/elementinjector/api/v1/config" \
        -H "requesttoken: YOUR_TOKEN" \
        --cookie "COOKIE_STRING"
   ```

## Mobile Support

The app also works on mobile devices:

```css
/* Responsive design in css/style.css */
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

## Updates

### Performing App Update

1. **Create backup:**
   ```bash
   cp -r apps/elementinjector apps/elementinjector.backup
   ```

2. **Copy new files**

3. **Clear cache:**
   ```bash
   sudo -u www-data php occ maintenance:repair
   ```

### Migrate Configuration

```javascript
// Export current configuration
const config = InjectorDebug.getStats().targetConfigs;
localStorage.setItem('elementinjector-backup', JSON.stringify(config));

// After update: Import
const backup = JSON.parse(localStorage.getItem('elementinjector-backup'));
await InjectorDebug.setConfig(backup);
```

## Advanced Features

### Batch Configuration

```bash
# Set multiple configurations via script
cat > import_config.json << 'EOF'
[
  {"text": "_AN", "template": "Offer", "className": "kat-angebot", "enabled": true},
  {"text": "_RE", "template": "Invoice", "className": "kat-rechnung", "enabled": true}
]
EOF

# Import via API
curl -X POST "https://your-nextcloud.com/apps/elementinjector/api/v1/config" \
     -H "Content-Type: application/json" \
     -H "requesttoken: YOUR_TOKEN" \
     -d @import_config.json
```

### Integration with Other Apps

```php
// In another app: Get configuration
$configController = \OC::$server->query(\OCA\ElementInjector\Controller\ConfigController::class);
$configs = $configController->getConfig();
```

## API Documentation

### GET /apps/elementinjector/api/v1/config

Retrieves the current user configuration.

**Response:**
```json
{
  "configs": [
    {
      "text": "_AN",
      "template": "<span class=\"badge badge-info\">Offer</span>",
      "className": "kat-angebot",
      "enabled": true
    }
  ]
}
```

### POST /apps/elementinjector/api/v1/config

Saves a new configuration.

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

## License

This app is licensed under the AGPL-3.0 License - see [LICENSE](LICENSE) for details.

**Made with love for the NextCloud Community**