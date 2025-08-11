(function() {
	'use strict';

	let currentConfigs = [];
	let isLoading = false;

	// Template-Definitionen
	const templates = {
		angebot: {
			template: '<span class="badge badge-info"><i class="fas fa-file-invoice"></i> Angebot</span>',
			className: 'kat-angebot',
			text: '_AN'
		},
		rechnung: {
			template: '<span class="badge badge-success"><i class="fas fa-receipt"></i> Rechnung</span>',
			className: 'kat-rechnung',
			text: '_RE'
		},
		lieferung: {
			template: '<span class="badge badge-warning"><i class="fas fa-truck"></i> Lieferung</span>',
			className: 'kat-lieferung',
			text: '_LI'
		},
		mahnung: {
			template: '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle"></i> Mahnung</span>',
			className: 'kat-mahnung',
			text: '_MA'
		},
		gutschrift: {
			template: '<span class="badge badge-secondary"><i class="fas fa-money-bill"></i> Gutschrift</span>',
			className: 'kat-gutschrift',
			text: '_GU'
		},
		bestellung: {
			template: '<span class="badge badge-primary"><i class="fas fa-shopping-cart"></i> Bestellung</span>',
			className: 'kat-bestellung',
			text: '_BE'
		}
	};

	document.addEventListener('DOMContentLoaded', function() {
		initElementInjector();
	});

	function initElementInjector() {
		loadConfiguration();
		bindEvents();
	}

	function bindEvents() {
		// Add new configuration
		document.getElementById('elementinjector-add-new').addEventListener('click', addNewConfiguration);
		
		// Save configuration
		document.getElementById('elementinjector-save').addEventListener('click', saveConfiguration);
		
		// Export/Import
		document.getElementById('elementinjector-export').addEventListener('click', exportConfiguration);
		document.getElementById('elementinjector-import').addEventListener('click', importConfiguration);
		
		// Template buttons
		document.querySelectorAll('.template-btn').forEach(btn => {
			btn.addEventListener('click', function() {
				const templateType = this.dataset.template;
				addTemplateConfiguration(templateType);
			});
		});
	}

	async function loadConfiguration() {
		showLoading(true);
		
		try {
			const response = await fetch(OC.generateUrl('/apps/elementinjector/api/v1/config'), {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'requesttoken': OC.requestToken
				}
			});

			if (response.ok) {
				const data = await response.json();
				currentConfigs = data.configs || [];
				renderConfigurations();
				showMessage('Configuration loaded successfully', 'success');
			} else {
				throw new Error('Failed to load configuration');
			}
		} catch (error) {
			console.error('Error loading configuration:', error);
			showMessage('Failed to load configuration', 'error');
			currentConfigs = [];
		} finally {
			showLoading(false);
		}
	}

	async function saveConfiguration() {
		if (isLoading) return;
		
		showLoading(true);
		
		try {
			const response = await fetch(OC.generateUrl('/apps/elementinjector/api/v1/config'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'requesttoken': OC.requestToken
				},
				body: JSON.stringify({ configs: currentConfigs })
			});

			if (response.ok) {
				const data = await response.json();
				showMessage(data.message || 'Configuration saved successfully', 'success');
			} else {
				const error = await response.json();
				throw new Error(error.error || 'Failed to save configuration');
			}
		} catch (error) {
			console.error('Error saving configuration:', error);
			showMessage('Failed to save configuration: ' + error.message, 'error');
		} finally {
			showLoading(false);
		}
	}

	function renderConfigurations() {
		const container = document.getElementById('elementinjector-configurations');
		container.innerHTML = '';

		currentConfigs.forEach((config, index) => {
			const configDiv = document.createElement('div');
			configDiv.className = 'elementinjector-config-item';
			configDiv.innerHTML = `
				<div class="config-row">
					<label>${t('elementinjector', 'Text Pattern:')}</label>
					<input type="text" class="config-text" value="${escapeHtml(config.text)}" data-index="${index}" data-field="text">
				</div>
				<div class="config-row">
					<label>${t('elementinjector', 'CSS Class:')}</label>
					<input type="text" class="config-class" value="${escapeHtml(config.className)}" data-index="${index}" data-field="className">
				</div>
				<div class="config-row">
					<label>${t('elementinjector', 'Template:')}</label>
					<textarea class="config-template" data-index="${index}" data-field="template">${escapeHtml(config.template)}</textarea>
				</div>
				<div class="config-row">
					<label>
						<input type="checkbox" class="config-enabled" ${config.enabled ? 'checked' : ''} data-index="${index}" data-field="enabled">
						${t('elementinjector', 'Enabled')}
					</label>
					<button class="button icon-delete config-delete" data-index="${index}" title="${t('elementinjector', 'Delete')}"></button>
				</div>
			`;
			container.appendChild(configDiv);
		});

		// Bind events for config items
		bindConfigEvents();
		updatePreview();
	}

	function bindConfigEvents() {
		// Input change events
		document.querySelectorAll('.config-text, .config-class, .config-template').forEach(input => {
			input.addEventListener('input', function() {
				const index = parseInt(this.dataset.index);
				const field = this.dataset.field;
				currentConfigs[index][field] = this.value;
				updatePreview();
			});
		});

		// Checkbox change events
		document.querySelectorAll('.config-enabled').forEach(checkbox => {
			checkbox.addEventListener('change', function() {
				const index = parseInt(this.dataset.index);
				currentConfigs[index].enabled = this.checked;
				updatePreview();
			});
		});

		// Delete buttons
		document.querySelectorAll('.config-delete').forEach(button => {
			button.addEventListener('click', function() {
				const index = parseInt(this.dataset.index);
				deleteConfiguration(index);
			});
		});
	}

	function addNewConfiguration() {
		const newConfig = {
			text: '_XX',
			template: '<span class="badge badge-info">New Type</span>',
			className: 'kat-custom',
			enabled: true
		};
		
		currentConfigs.push(newConfig);
		renderConfigurations();
	}

	function addTemplateConfiguration(templateType) {
		const template = templates[templateType];
		if (!template) return;

		// Check if already exists
		const exists = currentConfigs.some(config => config.text === template.text);
		if (exists) {
			showMessage(`Configuration for "${template.text}" already exists`, 'warning');
			return;
		}

		currentConfigs.push({
			text: template.text,
			template: template.template,
			className: template.className,
			enabled: true
		});
		
		renderConfigurations();
	}

	function deleteConfiguration(index) {
		if (confirm(t('elementinjector', 'Are you sure you want to delete this configuration?'))) {
			currentConfigs.splice(index, 1);
			renderConfigurations();
		}
	}

	function updatePreview() {
		const preview = document.getElementById('elementinjector-preview');
		preview.innerHTML = '';

		const enabledConfigs = currentConfigs.filter(config => config.enabled);
		
		if (enabledConfigs.length === 0) {
			preview.innerHTML = '<p>' + t('elementinjector', 'No active configurations') + '</p>';
			return;
		}

		enabledConfigs.forEach(config => {
			const previewItem = document.createElement('div');
			previewItem.className = 'preview-item';
			previewItem.innerHTML = `
				<span class="filename-example">file${config.text}.pdf</span>
				<span class="arrow">→</span>
				<span class="template-preview">${config.template}</span>
			`;
			preview.appendChild(previewItem);
		});
	}

	function exportConfiguration() {
		const dataStr = JSON.stringify(currentConfigs, null, 2);
		const dataBlob = new Blob([dataStr], {type: 'application/json'});
		
		const link = document.createElement('a');
		link.href = URL.createObjectURL(dataBlob);
		link.download = 'elementinjector-config.json';
		link.click();
	}

	function importConfiguration() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = function(event) {
			const file = event.target.files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = function(e) {
					try {
						const imported = JSON.parse(e.target.result);
						if (Array.isArray(imported)) {
							currentConfigs = imported;
							renderConfigurations();
							showMessage('Configuration imported successfully', 'success');
						} else {
							throw new Error('Invalid file format');
						}
					} catch (error) {
						showMessage('Failed to import configuration: ' + error.message, 'error');
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	}

	function showLoading(show) {
		isLoading = show;
		const loading = document.getElementById('elementinjector-loading');
		const content = document.getElementById('elementinjector-content');
		
		if (show) {
			loading.style.display = 'block';
			content.style.display = 'none';
		} else {
			loading.style.display = 'none';
			content.style.display = 'block';
		}
	}

	function showMessage(message, type) {
		const messageDiv = document.getElementById('elementinjector-message');
		messageDiv.textContent = message;
		messageDiv.className = 'msg ' + (type || 'success');
		messageDiv.style.display = 'block';
		
		setTimeout(() => {
			messageDiv.style.display = 'none';
		}, 5000);
	}

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Hilfsfunktion für Übersetzungen (falls nicht verfügbar)
	if (typeof t === 'undefined') {
		window.t = function(app, text) {
			return text;
		};
	}
})();