// apps/nextinject/js/admin.js
(function() {
	'use strict';

	let currentConfigs = [];
	let isLoading = false;

	// Template-Definitionen
	const templates = {
		angebot: {
			template: '<span class="badge badge-info"><i class="icon-file"></i> Angebot</span>',
			className: 'kat-angebot',
			text: '_AN',
			description: 'Angebots-Dokumente'
		},
		rechnung: {
			template: '<span class="badge badge-success"><i class="icon-checkmark"></i> Rechnung</span>',
			className: 'kat-rechnung',
			text: '_RE',
			description: 'Rechnungs-Dokumente'
		},
		lieferung: {
			template: '<span class="badge badge-warning"><i class="icon-package"></i> Lieferung</span>',
			className: 'kat-lieferung',
			text: '_LI',
			description: 'Lieferungs-Dokumente'
		},
		mahnung: {
			template: '<span class="badge badge-danger"><i class="icon-alert"></i> Mahnung</span>',
			className: 'kat-mahnung',
			text: '_MA',
			description: 'Mahnungs-Dokumente'
		},
		gutschrift: {
			template: '<span class="badge badge-secondary"><i class="icon-money"></i> Gutschrift</span>',
			className: 'kat-gutschrift',
			text: '_GU',
			description: 'Gutschrift-Dokumente'
		},
		bestellung: {
			template: '<span class="badge badge-primary"><i class="icon-cart"></i> Bestellung</span>',
			className: 'kat-bestellung',
			text: '_BE',
			description: 'Bestellungs-Dokumente'
		}
	};

	document.addEventListener('DOMContentLoaded', function() {
		initNextInjectAdmin();
	});

	function initNextInjectAdmin() {
		loadConfiguration();
		bindEvents();
	}

	function bindEvents() {
		// Quick Actions
		document.getElementById('nextinject-add-new')?.addEventListener('click', addNewConfiguration);
		document.getElementById('nextinject-reset')?.addEventListener('click', resetToDefaults);
		document.getElementById('nextinject-save')?.addEventListener('click', saveConfiguration);
		document.getElementById('nextinject-test')?.addEventListener('click', testConfiguration);
		
		// Export/Import
		document.getElementById('nextinject-export')?.addEventListener('click', exportConfiguration);
		document.getElementById('nextinject-import')?.addEventListener('click', importConfiguration);
		
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
			const response = await fetch(OC.generateUrl('/apps/nextinject/api/v1/admin/config'), {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'requesttoken': OC.requestToken
				}
			});

			if (response.ok) {
				const data = await response.json();
				currentConfigs = data.configs || [];
				updateStatistics();
				renderConfigurations();
				showMessage('Configuration loaded successfully', 'success');
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error) {
			console.error('Error loading admin configuration:', error);
			showMessage('Failed to load configuration: ' + error.message, 'error');
			currentConfigs = [];
		} finally {
			showLoading(false);
		}
	}

	async function saveConfiguration() {
		if (isLoading) return;
		
		showLoading(true);
		
		try {
			const response = await fetch(OC.generateUrl('/apps/nextinject/api/v1/admin/config'), {
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
				updateStatistics();
				document.getElementById('last-modified').textContent = new Date().toLocaleString();
			} else {
				const error = await response.json();
				throw new Error(error.error || 'Failed to save configuration');
			}
		} catch (error) {
			console.error('Error saving admin configuration:', error);
			showMessage('Failed to save configuration: ' + error.message, 'error');
		} finally {
			showLoading(false);
		}
	}

	async function resetToDefaults() {
		if (!confirm('Are you sure you want to reset all configurations to defaults? This cannot be undone.')) {
			return;
		}

		const defaultConfigs = [
			{
				text: '_AN',
				template: '<span class="badge badge-info"><i class="icon-file"></i> Angebot</span>',
				className: 'kat-angebot',
				enabled: true,
				description: 'Angebots-Dokumente'
			},
			{
				text: '_RE',
				template: '<span class="badge badge-success"><i class="icon-checkmark"></i> Rechnung</span>',
				className: 'kat-rechnung',
				enabled: true,
				description: 'Rechnungs-Dokumente'
			}
		];

		currentConfigs = defaultConfigs;
		renderConfigurations();
		showMessage('Configuration reset to defaults', 'success');
	}

	function testConfiguration() {
		const enabledConfigs = currentConfigs.filter(config => config.enabled);
		if (enabledConfigs.length === 0) {
			showMessage('No enabled configurations to test', 'warning');
			return;
		}

		const testResults = {
			total: enabledConfigs.length,
			valid: 0,
			errors: []
		};

		enabledConfigs.forEach((config, index) => {
			try {
				// Validate template HTML
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = config.template;
				
				// Validate CSS class
				if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.className)) {
					throw new Error(`Invalid CSS class: ${config.className}`);
				}
				
				// Validate text pattern
				if (!config.text || config.text.length === 0) {
					throw new Error('Empty text pattern');
				}
				
				testResults.valid++;
			} catch (error) {
				testResults.errors.push(`Config ${index + 1} (${config.text}): ${error.message}`);
			}
		});

		if (testResults.errors.length === 0) {
			showMessage(`All ${testResults.total} configurations are valid!`, 'success');
		} else {
			showMessage(`${testResults.valid}/${testResults.total} configurations valid. Errors: ${testResults.errors.join(', ')}`, 'warning');
		}
	}

	function updateStatistics() {
		document.getElementById('total-configs').textContent = currentConfigs.length;
		document.getElementById('active-configs').textContent = currentConfigs.filter(c => c.enabled).length;
	}

	function renderConfigurations() {
		const container = document.getElementById('nextinject-configurations');
		if (!container) return;
		
		container.innerHTML = '';

		if (currentConfigs.length === 0) {
			container.innerHTML = `
				<div class="empty-state">
					<h3>No configurations yet</h3>
					<p>Add your first configuration using the buttons above.</p>
				</div>
			`;
			updatePreview();
			return;
		}

		currentConfigs.forEach((config, index) => {
			const configDiv = document.createElement('div');
			configDiv.className = 'nextinject-config-item';
			configDiv.innerHTML = `
				<div class="config-header">
					<h4>Configuration ${index + 1}</h4>
					<div class="config-actions">
						<button class="button icon-delete config-delete" data-index="${index}" title="Delete"></button>
					</div>
				</div>
				
				<div class="config-content">
					<div class="config-row">
						<label>Text Pattern:</label>
						<input type="text" class="config-text" value="${escapeHtml(config.text)}" 
							   data-index="${index}" data-field="text" placeholder="e.g., _AN, _RE">
						<small>Pattern to match in filenames</small>
					</div>
					
					<div class="config-row">
						<label>CSS Class:</label>
						<input type="text" class="config-class" value="${escapeHtml(config.className)}" 
							   data-index="${index}" data-field="className" placeholder="e.g., kat-angebot">
						<small>CSS class for styling</small>
					</div>
					
					<div class="config-row">
						<label>Description:</label>
						<input type="text" class="config-description" value="${escapeHtml(config.description || '')}" 
							   data-index="${index}" data-field="description" placeholder="Optional description">
					</div>
					
					<div class="config-row full-width">
						<label>HTML Template:</label>
						<textarea class="config-template" data-index="${index}" data-field="template" 
								  placeholder="HTML template for the badge">${escapeHtml(config.template)}</textarea>
						<small>HTML code that will be injected</small>
					</div>
					
					<div class="config-row">
						<label class="checkbox-label">
							<input type="checkbox" class="config-enabled" ${config.enabled ? 'checked' : ''} 
								   data-index="${index}" data-field="enabled">
							Enabled
						</label>
						<div class="config-preview-mini">
							<span class="preview-label">Preview:</span>
							<span class="preview-content">${config.template}</span>
						</div>
					</div>
				</div>
			`;
			container.appendChild(configDiv);
		});

		bindConfigEvents();
		updatePreview();
	}

	function bindConfigEvents() {
		// Input change events
		document.querySelectorAll('.config-text, .config-class, .config-template, .config-description').forEach(input => {
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
			text: '_NEW',
			template: '<span class="badge badge-info">New Type</span>',
			className: 'kat-new',
			enabled: true,
			description: 'New configuration'
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
			enabled: true,
			description: template.description
		});
		
		renderConfigurations();
		showMessage(`Added template: ${template.description}`, 'success');
	}

	function deleteConfiguration(index) {
		const config = currentConfigs[index];
		if (confirm(`Are you sure you want to delete the configuration for "${config.text}"?`)) {
			currentConfigs.splice(index, 1);
			renderConfigurations();
			showMessage('Configuration deleted', 'success');
		}
	}

	function updatePreview() {
		const preview = document.getElementById('nextinject-preview');
		if (!preview) return;
		
		preview.innerHTML = '';

		const enabledConfigs = currentConfigs.filter(config => config.enabled);
		
		if (enabledConfigs.length === 0) {
			preview.innerHTML = `<p class="no-preview">No active configurations to preview</p>`;
			return;
		}

		const previewHeader = document.createElement('div');
		previewHeader.className = 'preview-header';
		previewHeader.innerHTML = `
			<h4>Files App Preview</h4>
			<p>This is how badges will appear next to matching filenames:</p>
		`;
		preview.appendChild(previewHeader);

		const previewGrid = document.createElement('div');
		previewGrid.className = 'preview-grid';
		
		enabledConfigs.forEach(config => {
			const previewItem = document.createElement('div');
			previewItem.className = 'preview-item';
			previewItem.innerHTML = `
				<div class="filename-example">
					<span class="filename">document${config.text}.pdf</span>
					<span class="arrow">→</span>
					<span class="template-preview">${config.template}</span>
				</div>
				<div class="config-details">
					<small>${config.description || config.text}</small>
				</div>
			`;
			previewGrid.appendChild(previewItem);
		});
		
		preview.appendChild(previewGrid);
	}

	function exportConfiguration() {
		const exportData = {
			version: '1.0.0',
			exported: new Date().toISOString(),
			configs: currentConfigs
		};
		
		const dataStr = JSON.stringify(exportData, null, 2);
		const dataBlob = new Blob([dataStr], {type: 'application/json'});
		
		const link = document.createElement('a');
		link.href = URL.createObjectURL(dataBlob);
		link.download = `nextinject-config-${new Date().toISOString().split('T')[0]}.json`;
		link.click();
		
		showMessage('Configuration exported successfully', 'success');
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
						
						if (imported.configs && Array.isArray(imported.configs)) {
							if (confirm(`Import ${imported.configs.length} configurations? This will replace current settings.`)) {
								currentConfigs = imported.configs;
								renderConfigurations();
								showMessage(`Imported ${imported.configs.length} configurations successfully`, 'success');
							}
						} else if (Array.isArray(imported)) {
							if (confirm(`Import ${imported.length} configurations? This will replace current settings.`)) {
								currentConfigs = imported;
								renderConfigurations();
								showMessage(`Imported ${imported.length} configurations successfully`, 'success');
							}
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
		const loading = document.getElementById('nextinject-loading');
		const content = document.getElementById('nextinject-content');
		
		if (loading && content) {
			if (show) {
				loading.style.display = 'block';
				content.style.display = 'none';
			} else {
				loading.style.display = 'none';
				content.style.display = 'block';
			}
		}
	}

	function showMessage(message, type) {
		const messageDiv = document.getElementById('nextinject-message');
		if (messageDiv) {
			messageDiv.textContent = message;
			messageDiv.className = 'msg ' + (type || 'success');
			messageDiv.style.display = 'block';
			
			setTimeout(() => {
				messageDiv.style.display = 'none';
			}, 5000);
		}
	}

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text || '';
		return div.innerHTML;
	}

	// Global Admin Debug Interface
	window.NextInjectAdmin = {
		getConfigs: () => currentConfigs,
		reloadConfig: loadConfiguration,
		exportConfig: exportConfiguration,
		testConfig: testConfiguration
	};

})();