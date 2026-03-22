(() => {
	'use strict';

	const root = document.getElementById('nextinject-admin');
	if (!root) {
		return;
	}

	const initialPayload = (() => {
		try {
			return JSON.parse(window.atob(root.dataset.initial || ''));
		} catch (error) {
			console.error('NextInject: failed to parse initial payload', error);
			return {};
		}
	})();

	const state = {
		loading: false,
		saving: false,
		message: null,
		rules: Array.isArray(initialPayload.rules) ? initialPayload.rules : [],
		settings: initialPayload.settings || { injectionDelay: 180, debugMode: false },
		presets: initialPayload.presets || {},
		stats: initialPayload.stats || { total: 0, active: 0, lastModified: 'Never' },
		meta: initialPayload.meta || {},
		fileInputMounted: false,
	};

	const api = {
		adminConfig: OC.generateUrl('/apps/nextinject/api/v1/admin/config'),
		adminReset: OC.generateUrl('/apps/nextinject/api/v1/admin/config/reset'),
		adminImport: OC.generateUrl('/apps/nextinject/api/v1/admin/config/import'),
		adminExport: OC.generateUrl('/apps/nextinject/api/v1/admin/config/export'),
	};

	const presetList = () => Object.values(state.presets);

	const createRuleFromPreset = (presetKey) => {
		const preset = state.presets[presetKey] || state.presets.hinweis;
		const matcherDefaults = {
			angebot: '_AN',
			rechnung: '_RE',
			lieferung: '_LI',
			bestellung: '_BE',
			protokoll: '_PROT',
			hinweis: '_TAG',
		};
		const actionDefaults = {
			angebot: {
				enabled: true,
				label: 'Angebot bestätigen',
				url: 'https://www.telefonansagen.de/kontakt/bestaetigen?kunde={contextLabel}',
				variant: 'primary',
			},
			rechnung: {
				enabled: true,
				label: 'Zahlung mitteilen',
				url: 'https://www.telefonansagen.de/kontakt/zahlung-mitteilen?kunde={contextLabel}',
				variant: 'secondary',
			},
		};

		return {
			id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			enabled: true,
			label: preset.label,
			matcher: {
				type: 'substring',
				value: matcherDefaults[presetKey] || '_TAG',
				caseSensitive: true,
			},
			surfaces: ['files', 'public'],
			badgePreset: preset.key,
			headerAction: actionDefaults[presetKey] || null,
			description: preset.description || '',
			priority: preset.defaultPriority || 100,
		};
	};

	const emptyRule = () => ({
		id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		enabled: true,
		label: 'Neue Regel',
		matcher: { type: 'substring', value: '', caseSensitive: true },
		surfaces: ['files'],
		badgePreset: 'hinweis',
		headerAction: null,
		description: '',
		priority: 100,
	});

	const escapeHtml = (value) => String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

	const selected = (condition) => (condition ? ' selected' : '');
	const checked = (condition) => (condition ? ' checked' : '');

	const normalizeStats = () => {
		state.stats = {
			total: state.rules.length,
			active: state.rules.filter((rule) => rule.enabled).length,
			lastModified: state.stats.lastModified || 'Never',
		};
	};

	const sampleFileNames = [
		'Kunde_AN-Angebot.pdf',
		'Kunde_RE-Rechnung.pdf',
		'Kunde_LI-Lieferung.pdf',
		'Projekt_PROT-Abnahme.docx',
	];

	const matchesRule = (value, rule) => {
		const haystack = rule.matcher.caseSensitive ? value : value.toLowerCase();
		const needle = rule.matcher.caseSensitive ? rule.matcher.value : rule.matcher.value.toLowerCase();
		return needle !== '' && haystack.includes(needle);
	};

	const renderBadge = (rule) => {
		const preset = state.presets[rule.badgePreset] || state.presets.hinweis;
		return `<span class="nextinject-badge ${escapeHtml(preset.className)}"><span class="nextinject-badge__icon">${escapeHtml(preset.icon)}</span><span>${escapeHtml(preset.text)}</span></span>`;
	};

	const renderPreview = () => {
		const activeRules = state.rules.filter((rule) => rule.enabled && rule.matcher.value);
		const filePreview = sampleFileNames.map((fileName) => {
			const badges = activeRules
				.filter((rule) => rule.surfaces.includes('files') && matchesRule(fileName, rule))
				.sort((a, b) => b.priority - a.priority)
				.map((rule) => renderBadge(rule))
				.join('');

			return `
				<div class="nextinject-preview__row">
					<div class="nextinject-preview__filename">${escapeHtml(fileName)}</div>
					<div class="nextinject-preview__badges">${badges || '<span class="nextinject-preview__muted">keine Markierung</span>'}</div>
				</div>
			`;
		}).join('');

		const publicActions = activeRules
			.filter((rule) => rule.surfaces.includes('public') && rule.headerAction)
			.sort((a, b) => b.priority - a.priority)
			.map((rule) => {
				const action = rule.headerAction;
				return `<a class="nextinject-public-action nextinject-public-action--${escapeHtml(action.variant)}" href="#">${escapeHtml(action.label)}</a>`;
			})
			.join('');

		return `
			<div class="nextinject-preview">
				<div class="nextinject-preview__surface">
					<h3>Dateiliste</h3>
					${filePreview}
				</div>
				<div class="nextinject-preview__surface">
					<h3>Public Share Header</h3>
					<div class="nextinject-preview__header">
						<div class="nextinject-preview__title">Projekt_AN Freigabe</div>
						<div class="nextinject-preview__actions">${publicActions || '<span class="nextinject-preview__muted">keine Aktion</span>'}</div>
					</div>
				</div>
			</div>
		`;
	};

	const renderRuleCard = (rule, index) => `
		<section class="nextinject-rule-card" data-rule-index="${index}">
			<div class="nextinject-rule-card__header">
				<div>
					<h3>${escapeHtml(rule.label || 'Regel')}</h3>
					<p>${escapeHtml(rule.description || 'Keine Beschreibung')}</p>
				</div>
				<div class="nextinject-rule-card__toggles">
					<label class="nextinject-switch">
						<input type="checkbox" data-field="enabled"${checked(rule.enabled)}>
						<span>Aktiv</span>
					</label>
					<button class="button button-vuejs-destructive" type="button" data-action="remove-rule">Löschen</button>
				</div>
			</div>
			<div class="nextinject-rule-grid">
				<label>
					<span>Label</span>
					<input type="text" data-field="label" value="${escapeHtml(rule.label)}">
				</label>
				<label>
					<span>Matcher</span>
					<input type="text" data-field="matcher.value" value="${escapeHtml(rule.matcher.value)}" placeholder="_AN">
				</label>
				<label>
					<span>Badge-Preset</span>
					<select data-field="badgePreset">
						${presetList().map((preset) => `<option value="${escapeHtml(preset.key)}"${selected(rule.badgePreset === preset.key)}>${escapeHtml(preset.label)}</option>`).join('')}
					</select>
				</label>
				<label>
					<span>Priorität</span>
					<input type="number" data-field="priority" min="0" max="999" value="${escapeHtml(rule.priority)}">
				</label>
				<label class="nextinject-rule-grid__wide">
					<span>Beschreibung</span>
					<input type="text" data-field="description" value="${escapeHtml(rule.description)}">
				</label>
				<label class="nextinject-switch">
					<input type="checkbox" data-field="matcher.caseSensitive"${checked(rule.matcher.caseSensitive)}>
					<span>Case-sensitive Match</span>
				</label>
			</div>
			<div class="nextinject-surface-selector">
				<span>Oberflächen</span>
				<label class="nextinject-switch">
					<input type="checkbox" data-surface="files"${checked(rule.surfaces.includes('files'))}>
					<span>Files</span>
				</label>
				<label class="nextinject-switch">
					<input type="checkbox" data-surface="public"${checked(rule.surfaces.includes('public'))}>
					<span>Public</span>
				</label>
			</div>
			<div class="nextinject-header-action">
				<label class="nextinject-switch">
					<input type="checkbox" data-field="headerAction.enabled"${checked(Boolean(rule.headerAction))}>
					<span>Header-Aktion im Public Share</span>
				</label>
				<div class="nextinject-header-action__grid"${rule.headerAction ? '' : ' hidden'}>
					<label>
						<span>Button-Label</span>
						<input type="text" data-field="headerAction.label" value="${escapeHtml(rule.headerAction?.label || '')}">
					</label>
					<label>
						<span>URL</span>
						<input type="url" data-field="headerAction.url" value="${escapeHtml(rule.headerAction?.url || '')}" placeholder="https://…?kunde={contextLabel}">
					</label>
					<label>
						<span>Variante</span>
						<select data-field="headerAction.variant">
							<option value="primary"${selected(rule.headerAction?.variant === 'primary')}>Primary</option>
							<option value="secondary"${selected(!rule.headerAction || rule.headerAction.variant === 'secondary')}>Secondary</option>
							<option value="warning"${selected(rule.headerAction?.variant === 'warning')}>Warning</option>
						</select>
					</label>
				</div>
			</div>
		</section>
	`;

	const render = () => {
		normalizeStats();

		root.innerHTML = `
			<div class="nextinject-shell">
				<header class="nextinject-hero">
					<div>
						<p class="nextinject-eyebrow">NextInject</p>
						<h1>NC32 Filetagging &amp; Public Actions</h1>
						<p class="nextinject-lead">Zentrale Regeln für Dateimarker, Public-Share-Header-Aktionen und Telefonansagen-Presets.</p>
					</div>
					<div class="nextinject-hero__actions">
						<button class="button primary" type="button" data-action="add-rule">Regel hinzufügen</button>
						<button class="button" type="button" data-action="save"${state.saving ? ' disabled' : ''}>${state.saving ? 'Speichert…' : 'Speichern'}</button>
					</div>
				</header>

				<section class="nextinject-stats">
					<article class="nextinject-stat"><span>Total</span><strong>${escapeHtml(state.stats.total)}</strong></article>
					<article class="nextinject-stat"><span>Aktiv</span><strong>${escapeHtml(state.stats.active)}</strong></article>
					<article class="nextinject-stat"><span>Zuletzt geändert</span><strong>${escapeHtml(state.stats.lastModified)}</strong></article>
				</section>

				${state.meta?.migratedFrom ? `
					<section class="nextinject-panel nextinject-panel--compact">
						<div class="nextinject-panel__header">
							<h2>Migrationsstatus</h2>
						</div>
						<p class="nextinject-panel__meta">Übernommen aus: ${escapeHtml(state.meta.migratedFrom)}</p>
					</section>
				` : ''}

				${state.message ? `<div class="nextinject-message nextinject-message--${escapeHtml(state.message.type)}">${escapeHtml(state.message.text)}</div>` : ''}

				<section class="nextinject-panel">
					<div class="nextinject-panel__header">
						<h2>Preset-Galerie</h2>
						<div class="nextinject-preset-grid">
							${presetList().map((preset) => `
								<button class="nextinject-preset" type="button" data-action="add-preset" data-preset="${escapeHtml(preset.key)}">
									${renderBadge({ badgePreset: preset.key })}
									<span>${escapeHtml(preset.description)}</span>
								</button>
							`).join('')}
						</div>
					</div>
				</section>

				<section class="nextinject-panel">
					<div class="nextinject-panel__header">
						<h2>Regeln</h2>
						<div class="nextinject-toolbar">
							<button class="button" type="button" data-action="reset">Defaults laden</button>
							<button class="button" type="button" data-action="export">Export</button>
							<button class="button" type="button" data-action="import">Import</button>
						</div>
					</div>
					<div class="nextinject-rules">
						${state.rules.map((rule, index) => renderRuleCard(rule, index)).join('') || '<div class="nextinject-empty">Noch keine Regeln angelegt.</div>'}
					</div>
				</section>

				<section class="nextinject-panel">
					<div class="nextinject-panel__header">
						<h2>Laufzeit &amp; Vorschau</h2>
					</div>
					<div class="nextinject-runtime-grid">
						<label>
							<span>Injection Delay (ms)</span>
							<input type="number" min="0" max="5000" data-settings-field="injectionDelay" value="${escapeHtml(state.settings.injectionDelay)}">
						</label>
						<label class="nextinject-switch">
							<input type="checkbox" data-settings-field="debugMode"${checked(state.settings.debugMode)}>
							<span>Debug-Ausgabe aktivieren</span>
						</label>
					</div>
					${renderPreview()}
				</section>
			</div>
			<input id="nextinject-import-input" type="file" accept="application/json" hidden>
		`;
	};

	const setMessage = (text, type = 'success') => {
		state.message = { text, type };
		render();
	};

	const updateNestedValue = (target, path, value) => {
		const segments = path.split('.');
		let current = target;
		for (let i = 0; i < segments.length - 1; i += 1) {
			current[segments[i]] = current[segments[i]] || {};
			current = current[segments[i]];
		}
		current[segments.at(-1)] = value;
	};

	const ruleFromElement = (element) => {
		const card = element.closest('[data-rule-index]');
		if (!card) {
			return null;
		}
		const index = Number(card.dataset.ruleIndex);
		return Number.isInteger(index) ? { index, rule: state.rules[index] } : null;
	};

	const saveState = async () => {
		state.saving = true;
		render();
		try {
			const response = await fetch(api.adminConfig, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					requesttoken: OC.requestToken,
				},
				credentials: 'same-origin',
				body: JSON.stringify({
					rules: state.rules,
					settings: state.settings,
				}),
			});

			const payload = await response.json();
			if (!response.ok || !payload.state) {
				throw new Error(payload.error || 'Konfiguration konnte nicht gespeichert werden.');
			}

			Object.assign(state, {
				rules: payload.state.rules,
				settings: payload.state.settings,
				presets: payload.state.presets,
				stats: payload.state.stats,
				meta: payload.state.meta,
				saving: false,
			});
			setMessage('Konfiguration gespeichert.', 'success');
		} catch (error) {
			state.saving = false;
			setMessage(error.message || 'Speichern fehlgeschlagen.', 'error');
		}
	};

	const postSimpleAction = async (url) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				requesttoken: OC.requestToken,
			},
			credentials: 'same-origin',
		});
		const payload = await response.json();
		if (!response.ok || !payload.state) {
			throw new Error(payload.error || 'Aktion fehlgeschlagen.');
		}

		Object.assign(state, {
			rules: payload.state.rules,
			settings: payload.state.settings,
			presets: payload.state.presets,
			stats: payload.state.stats,
			meta: payload.state.meta,
		});
	};

	const importConfiguration = async (file) => {
		const content = await file.text();
		let parsed;
		try {
			parsed = JSON.parse(content);
		} catch (error) {
			setMessage('Import-Datei ist kein valides JSON.', 'error');
			return;
		}

		try {
			const response = await fetch(api.adminImport, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					requesttoken: OC.requestToken,
				},
				credentials: 'same-origin',
				body: JSON.stringify(parsed),
			});
			const payload = await response.json();
			if (!response.ok || !payload.state) {
				throw new Error(payload.error || 'Import fehlgeschlagen.');
			}

			Object.assign(state, {
				rules: payload.state.rules,
				settings: payload.state.settings,
				presets: payload.state.presets,
				stats: payload.state.stats,
				meta: payload.state.meta,
			});
			setMessage('Import erfolgreich übernommen.', 'success');
		} catch (error) {
			setMessage(error.message || 'Import fehlgeschlagen.', 'error');
		}
	};

	root.addEventListener('click', async (event) => {
		const actionNode = event.target.closest('[data-action]');
		if (!actionNode) {
			return;
		}

		const action = actionNode.dataset.action;

		if (action === 'add-rule') {
			state.rules.unshift(emptyRule());
			render();
			return;
		}

		if (action === 'add-preset') {
			state.rules.unshift(createRuleFromPreset(actionNode.dataset.preset));
			render();
			return;
		}

		if (action === 'remove-rule') {
			const entry = ruleFromElement(actionNode);
			if (!entry) {
				return;
			}
			state.rules.splice(entry.index, 1);
			render();
			return;
		}

		if (action === 'save') {
			await saveState();
			return;
		}

		if (action === 'reset') {
			try {
				await postSimpleAction(api.adminReset);
				setMessage('Defaults geladen.', 'success');
			} catch (error) {
				setMessage(error.message || 'Reset fehlgeschlagen.', 'error');
			}
			render();
			return;
		}

		if (action === 'export') {
			try {
				const response = await fetch(api.adminExport, {
					method: 'GET',
					headers: {
						Accept: 'application/json',
						requesttoken: OC.requestToken,
					},
					credentials: 'same-origin',
				});
				if (!response.ok) {
					throw new Error('Export fehlgeschlagen.');
				}
				const exportPayload = await response.json();
				const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = 'nextinject-config.json';
				link.click();
				URL.revokeObjectURL(link.href);
			} catch (error) {
				setMessage(error.message || 'Export fehlgeschlagen.', 'error');
			}
			return;
		}

		if (action === 'import') {
			root.querySelector('#nextinject-import-input')?.click();
		}
	});

	root.addEventListener('input', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
			return;
		}

		const ruleEntry = ruleFromElement(target);
		if (ruleEntry && target.dataset.field) {
			const { rule } = ruleEntry;
			let value = target.value;
			if (target.type === 'checkbox') {
				value = target.checked;
			} else if (target.type === 'number') {
				value = Number(target.value || 0);
			}

			if (target.dataset.field === 'headerAction.enabled') {
				rule.headerAction = target.checked ? (rule.headerAction || { enabled: true, label: '', url: '', variant: 'secondary' }) : null;
			} else {
				updateNestedValue(rule, target.dataset.field, value);
			}

			render();
			return;
		}

		if (target.dataset.settingsField) {
			state.settings[target.dataset.settingsField] = target.type === 'checkbox' ? target.checked : Number(target.value || 0);
			render();
		}
	});

	root.addEventListener('change', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}

		if (target.id === 'nextinject-import-input' && target.files?.[0]) {
			importConfiguration(target.files[0]);
			target.value = '';
			return;
		}

		if (target.dataset.surface) {
			const entry = ruleFromElement(target);
			if (!entry) {
				return;
			}

			const surfaces = new Set(entry.rule.surfaces);
			if (target.checked) {
				surfaces.add(target.dataset.surface);
			} else {
				surfaces.delete(target.dataset.surface);
			}
			entry.rule.surfaces = Array.from(surfaces);
			render();
		}
	});

	render();
})();
