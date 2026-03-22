(() => {
	'use strict';

	if (window.__nextInjectRuntimeActive) {
		return;
	}

	const detectSurface = () => {
		const path = window.location.pathname || '';
		if (document.body?.id === 'body-public' || /\/(index\.php\/)?s\//.test(path)) {
			return 'public';
		}
		if (path.includes('/apps/files')) {
			return 'files';
		}
		return null;
	};

	const surface = detectSurface();
	if (!surface) {
		return;
	}

	window.__nextInjectRuntimeActive = true;

	class NextInjectRuntime {
		constructor() {
			this.surface = surface;
			this.rules = [];
			this.settings = { injectionDelay: 180, debugMode: false };
			this.scanTimer = null;
			this.observer = null;
			this.historyPatched = false;
			this.instanceId = `nextinject-${Date.now()}`;
		}

		log(...args) {
			if (this.settings.debugMode) {
				console.log('[NextInject]', ...args);
			}
		}

		async init() {
			await this.loadConfig();
			this.mount();
		}

		async loadConfig() {
			try {
				const response = await fetch(OC.generateUrl('/apps/nextinject/api/v1/frontend/config'), {
					credentials: 'same-origin',
					headers: { Accept: 'application/json' },
				});
				const contentType = response.headers.get('content-type') || '';
				if (!contentType.includes('application/json')) {
					throw new Error(`Unexpected response type (${response.status})`);
				}
				const payload = await response.json();
				if (!Array.isArray(payload.rules)) {
					throw new Error(`Invalid config payload (${response.status})`);
				}
				this.rules = Array.isArray(payload.rules) ? payload.rules : [];
				this.settings = payload.settings || this.settings;
				if (!response.ok) {
					this.log(`Loaded config with non-200 status ${response.status}`, payload);
				} else {
					this.log('Loaded config', this.rules);
				}
			} catch (error) {
				console.error('NextInject config loading failed:', error);
				this.rules = [];
			}
		}

		mount() {
			this.scheduleScan();
			this.setupObserver();
			this.patchHistory();
			window.addEventListener('hashchange', () => this.scheduleScan());
			window.addEventListener('load', () => this.scheduleScan());
		}

		setupObserver() {
			const target = this.getObserverTarget();
			if (!target) {
				return;
			}

			this.observer = new MutationObserver(() => this.scheduleScan());
			this.observer.observe(target, { childList: true, subtree: true, characterData: true });
		}

		getObserverTarget() {
			return document.querySelector('#content')
				|| document.querySelector('#app-content')
				|| document.body;
		}

		patchHistory() {
			if (window.__nextInjectHistoryPatched) {
				return;
			}

			window.__nextInjectHistoryPatched = true;
			const trigger = () => this.scheduleScan();
			const originalPushState = history.pushState;
			const originalReplaceState = history.replaceState;

			history.pushState = (...args) => {
				originalPushState.apply(history, args);
				trigger();
			};
			history.replaceState = (...args) => {
				originalReplaceState.apply(history, args);
				trigger();
			};
		}

		scheduleScan() {
			window.clearTimeout(this.scanTimer);
			this.scanTimer = window.setTimeout(() => this.scan(), this.settings.injectionDelay || 180);
		}

		scan() {
			this.cleanup();

			const contextLabel = this.getContextLabel();
			const fileTargets = this.getFileTargets();
			const applicableRules = this.rules
				.filter((rule) => Array.isArray(rule.surfaces) && rule.surfaces.includes(this.surface))
				.sort((a, b) => (b.priority || 0) - (a.priority || 0));

			if (this.surface === 'files' || this.surface === 'public') {
				fileTargets.forEach((target) => {
					const matchingRule = applicableRules.find((rule) => this.matches(target.name, rule.matcher));
					if (matchingRule) {
						this.injectBadge(target, matchingRule);
					}
				});
			}

			if (this.surface === 'public') {
				const publicContext = this.getPublicContext(contextLabel);
				const activePublicRule = applicableRules.find((rule) =>
					rule.surfaces.includes('public') && this.contextMatchesRule(publicContext, rule)
				) || null;

				this.applyPublicThemeState(activePublicRule, publicContext);
				this.injectPublicActions(contextLabel, activePublicRule, publicContext);
			}
		}

		cleanup() {
			document.querySelectorAll(`[data-nextinject-owner="${this.instanceId}"]`).forEach((node) => node.remove());
			document.querySelectorAll('.nextinject-runtime-match').forEach((node) => node.classList.remove('nextinject-runtime-match'));
			document.body?.classList.remove('AN_open', 'RE_open', 'nextinject-offer-open', 'nextinject-invoice-open');
			document.querySelector('#header')?.classList.remove('gimmick_active');
			const provenExpert = document.querySelector('#ProvenExpert_widgetbar_container');
			if (provenExpert instanceof HTMLElement) {
				provenExpert.style.display = '';
			}
		}

		getContextLabel() {
			const candidates = [
				document.querySelector('#header .header-title'),
				document.querySelector('#header .header-appname'),
				document.querySelector('.public-page__heading'),
				document.querySelector('.files-list__row-name-link'),
				document.querySelector('#nextcloud'),
				document.querySelector('#content > h1'),
			];

			for (const candidate of candidates) {
				const text = candidate?.textContent?.trim();
				if (text) {
					return text;
				}
			}

			return document.title.replace(/\s*-\s*Nextcloud.*$/i, '').trim();
		}

		getFileTargets() {
			const modernRows = this.getModernFileTargets();
			if (modernRows.length > 0) {
				return modernRows;
			}

			const legacyRows = this.getLegacyFileTargets();
			if (legacyRows.length > 0) {
				return legacyRows;
			}

			return [];
		}

		getModernFileTargets() {
			const rows = Array.from(document.querySelectorAll('tr.files-list__row, [data-cy-files-list-row]'));
			const targets = [];
			const seen = new Set();

			rows.forEach((row) => {
				if (!(row instanceof HTMLElement)) {
					return;
				}

				const name = String(
					row.dataset.cyFilesListRowName
					|| row.getAttribute('data-cy-files-list-row-name')
					|| ''
				).trim();
				if (!name || seen.has(name)) {
					return;
				}

				const node = row.querySelector('.files-list__row-name-text > .files-list__row-name-')
					|| row.querySelector('.files-list__row-name-text')
					|| row.querySelector('.files-list__row-name-link')
					|| row.querySelector('[data-cy-files-list-row-name]');
				if (!(node instanceof HTMLElement)) {
					return;
				}

				seen.add(name);
				targets.push({ node, name, row });
			});

			return targets;
		}

		getLegacyFileTargets() {
			const rows = Array.from(document.querySelectorAll('tr[data-file], .files-filestable tbody tr'));
			const targets = [];
			const seen = new Set();

			rows.forEach((row) => {
				if (!(row instanceof HTMLElement) || row.querySelector('th')) {
					return;
				}

				const node = row.querySelector('td.filename .innernametext')
					|| row.querySelector('td.filename .nametext')
					|| row.querySelector('td.filename a.name')
					|| row.querySelector('td.filename')
					|| row.querySelector('.name');
				if (!(node instanceof HTMLElement)) {
					return;
				}

				const rawName = String(row.getAttribute('data-file') || node.textContent || '').trim();
				const name = rawName.replace(/\s+/g, ' ');
				if (!name || seen.has(name)) {
					return;
				}

				seen.add(name);
				targets.push({ node, name, row });
			});

			return targets;
		}

		getPublicContext(contextLabel) {
			const params = new URLSearchParams(window.location.search);
			const dir = decodeURIComponent(params.get('dir') || '');
			const activeViewerTitle = [
				document.querySelector('#viewer .modal-header__name'),
				document.querySelector('#viewer h2'),
				document.querySelector('.viewer__title'),
			].map((node) => node?.textContent?.trim()).find(Boolean) || '';

			const breadcrumbTexts = Array.from(document.querySelectorAll('.breadcrumb, .breadcrumbs, [data-cy-files-breadcrumbs] *'))
				.map((node) => node.textContent?.trim() || '')
				.filter(Boolean);

			const tokens = [
				contextLabel,
				dir,
				activeViewerTitle,
				...dir.split('/'),
				...breadcrumbTexts,
			].map((value) => String(value || '').trim()).filter(Boolean);

			return {
				contextLabel,
				dir,
				activeViewerTitle,
				tokens: Array.from(new Set(tokens)),
			};
		}

		contextMatchesRule(context, rule) {
			return context.tokens.some((token) => this.matches(token, rule.matcher));
		}

		matches(value, matcher) {
			if (!matcher?.value) {
				return false;
			}

			const haystack = matcher.caseSensitive ? value : value.toLowerCase();
			const needle = matcher.caseSensitive ? matcher.value : matcher.value.toLowerCase();
			return haystack.includes(needle);
		}

		injectBadge(target, rule) {
			const host = this.resolveBadgeHost(target.node);
			if (!host) {
				return;
			}

			const badge = document.createElement('span');
			badge.className = `nextinject-badge ${rule.badge.className || ''}`;
			badge.dataset.nextinjectOwner = this.instanceId;
			badge.dataset.nextinjectRule = rule.id;
			badge.innerHTML = `
				<span class="nextinject-badge__icon">${this.escape(rule.badge.icon || '')}</span>
				<span>${this.escape(rule.badge.text || rule.label)}</span>
			`;
			host.insertAdjacentElement('afterend', badge);
			host.classList.add('nextinject-runtime-match');
		}

		resolveBadgeHost(node) {
			const modernRow = node.closest?.('tr.files-list__row, [data-cy-files-list-row]');
			const modernNameText = modernRow?.querySelector?.('.files-list__row-name-text');
			if (modernNameText) {
				return modernNameText;
			}

			const nestedName = node.querySelector?.('.innernametext, .nametext, a.name, .files-list__row-name-link');
			if (nestedName) {
				return nestedName;
			}

			return node.closest('.nametext')
				|| node.closest('.filename')
				|| node.closest('a')
				|| node;
		}

		injectPublicActions(contextLabel, activeRule, publicContext) {
			const headerHost = document.querySelector('#header .header-end')
				|| document.querySelector('#header .header-right')
				|| document.querySelector('#header')
				|| document.body;

			if (!activeRule?.headerAction) {
				return;
			}

			const presetKey = activeRule.badge?.key || activeRule.badgePreset || '';
			if (presetKey === 'angebot' || presetKey === 'rechnung') {
				this.injectLegacyThemeCta(headerHost, activeRule, publicContext);
				return;
			}

			const wrapper = document.createElement('div');
			wrapper.className = 'nextinject-public-actions';
			wrapper.dataset.nextinjectOwner = this.instanceId;

			const link = document.createElement('a');
			link.className = `nextinject-public-action nextinject-public-action--${activeRule.headerAction.variant || 'secondary'}`;
			link.href = this.resolveActionUrl(activeRule.headerAction.url, {
				contextLabel,
				fileName: publicContext.activeViewerTitle || publicContext.dir,
			});
			link.target = '_blank';
			link.rel = 'noreferrer noopener';
			link.textContent = activeRule.headerAction.label;
			wrapper.appendChild(link);

			const publicPageMenu = headerHost.querySelector('#public-page-menu');
			if (publicPageMenu) {
				headerHost.insertBefore(wrapper, publicPageMenu);
			} else {
				headerHost.appendChild(wrapper);
			}
		}

		applyPublicThemeState(activeRule, publicContext) {
			if (!activeRule) {
				return;
			}

			const presetKey = activeRule.badge?.key || activeRule.badgePreset || '';
			const body = document.body;
			const header = document.querySelector('#header');
			const provenExpert = document.querySelector('#ProvenExpert_widgetbar_container');

			if (presetKey === 'angebot') {
				body?.classList.add('AN_open', 'nextinject-offer-open');
				header?.classList.add('gimmick_active');
			}

			if (presetKey === 'rechnung') {
				body?.classList.add('RE_open', 'nextinject-invoice-open');
			}

			if ((presetKey === 'angebot' || presetKey === 'rechnung') && provenExpert instanceof HTMLElement) {
				provenExpert.style.display = 'block';
			}
		}

		injectLegacyThemeCta(headerHost, activeRule, publicContext) {
			const presetKey = activeRule.badge?.key || activeRule.badgePreset || '';
			const insertBeforeTarget = headerHost.querySelector('#header-primary-action')
				|| headerHost.querySelector('#public-page-menu')
				|| null;

			const context = {
				contextLabel: publicContext.contextLabel,
				fileName: publicContext.activeViewerTitle || publicContext.dir,
			};

			if (presetKey === 'angebot' && activeRule.headerAction) {
				const link = document.createElement('a');
				link.className = 'cta_AN box';
				link.dataset.nextinjectOwner = this.instanceId;
				link.href = this.resolveActionUrl(activeRule.headerAction.url, context);
				link.target = '_blank';
				link.rel = 'noreferrer noopener';
				link.innerHTML = '<i></i><span>Angebot sofort bestätigen</span>';
				if (insertBeforeTarget) {
					headerHost.insertBefore(link, insertBeforeTarget);
				} else {
					headerHost.appendChild(link);
				}
			}

			if (presetKey === 'rechnung' && activeRule.headerAction) {
				const payment = document.createElement('a');
				payment.className = 'cta_RE box zahlung';
				payment.dataset.nextinjectOwner = this.instanceId;
				payment.href = this.resolveActionUrl(activeRule.headerAction.url, context);
				payment.target = '_blank';
				payment.rel = 'noreferrer noopener';
				payment.innerHTML = '<i></i><span>Zahlung mitteilen</span>';

				const iban = document.createElement('a');
				iban.className = 'cta_RE iban box';
				iban.dataset.nextinjectOwner = this.instanceId;
				iban.innerHTML = '<span>IBAN: <b>DE17664900000063058203</b></span>';

				if (insertBeforeTarget) {
					headerHost.insertBefore(payment, insertBeforeTarget);
					headerHost.insertBefore(iban, insertBeforeTarget);
				} else {
					headerHost.appendChild(payment);
					headerHost.appendChild(iban);
				}
			}
		}

		resolveActionUrl(urlTemplate, context) {
			return String(urlTemplate || '')
				.replaceAll('{contextLabel}', encodeURIComponent(context?.contextLabel || 'Freigabe'))
				.replaceAll('{fileName}', encodeURIComponent(context?.fileName || context?.contextLabel || 'Datei'));
		}

		escape(value) {
			return String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}
	}

	const runtime = new NextInjectRuntime();
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => runtime.init());
	} else {
		runtime.init();
	}
})();
