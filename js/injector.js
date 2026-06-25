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
			this.ensureLegacyThemeStyles();
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

			this.observer = new MutationObserver((mutations) => {
				if (mutations.some((mutation) => this.isExternalMutation(mutation))) {
					this.scheduleScan();
				}
			});
			this.observer.observe(target, { childList: true, subtree: true, characterData: true });
		}

		isExternalMutation(mutation) {
			if (mutation.type === 'characterData') {
				return !this.isOwnedMutationNode(mutation.target.parentElement);
			}

			return [...mutation.addedNodes, ...mutation.removedNodes]
				.some((node) => !this.isOwnedMutationNode(node));
		}

		isOwnedMutationNode(node) {
			if (!(node instanceof Element)) {
				return false;
			}

			return node.id === 'nextinject-legacy-theme-fixes'
				|| node.dataset.nextinjectOwner === this.instanceId
				|| Boolean(node.querySelector?.(`[data-nextinject-owner="${this.instanceId}"], #nextinject-legacy-theme-fixes`));
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

		ensureLegacyThemeStyles() {
			if (this.surface !== 'public' || document.querySelector('#nextinject-legacy-theme-fixes')) {
				return;
			}

			const style = document.createElement('style');
			style.id = 'nextinject-legacy-theme-fixes';
			style.textContent = `
body#body-public a.cta_AN.box,
body#body-public a.cta_RE.box {
	isolation: isolate !important;
	overflow: hidden !important;
	box-shadow: 0 2px 5px rgba(0, 120, 190, 0.1) !important;
	transform: none !important;
	transition: background-color 180ms ease, border-color 180ms ease, filter 180ms ease, box-shadow 180ms ease !important;
}

body#body-public a.cta_AN.box:hover,
body#body-public a.cta_RE.box:hover {
	box-shadow: 0 4px 10px rgba(0, 120, 190, 0.14) !important;
	filter: brightness(1.02);
	transform: none !important;
}

body#body-public a.cta_AN.box::before,
body#body-public a.cta_RE.box::before {
	content: "" !important;
	position: absolute !important;
	inset: -55% auto -55% -48% !important;
	width: 38% !important;
	height: auto !important;
	border-radius: 999px !important;
	background: linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.05) 18%, rgba(255, 255, 255, 0.36) 44%, rgba(255, 255, 255, 0.72) 50%, rgba(255, 255, 255, 0.28) 58%, transparent 82%) !important;
	filter: blur(1.5px) !important;
	opacity: 0;
	z-index: 1 !important;
	pointer-events: none !important;
	transform: skewX(-16deg) translateX(-210%);
	animation: nextinject-cta-sheen 4.8s cubic-bezier(0.22, 1, 0.36, 1) infinite !important;
}

body#body-public a.cta_AN.box::after,
body#body-public a.cta_RE.box::after {
	content: "" !important;
	position: absolute !important;
	inset: -32% auto -32% -18% !important;
	width: 10% !important;
	height: auto !important;
	border-radius: 999px !important;
	background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.82) 50%, transparent 100%) !important;
	opacity: 0;
	z-index: 1 !important;
	pointer-events: none !important;
	transform: skewX(-16deg) translateX(-260%);
	animation: nextinject-cta-sheen-core 4.8s cubic-bezier(0.22, 1, 0.36, 1) infinite !important;
}

body#body-public a.cta_AN.box > i,
body#body-public a.cta_AN.box > span,
body#body-public a.cta_RE.box > i,
body#body-public a.cta_RE.box > span {
	position: relative !important;
	z-index: 2 !important;
}

@keyframes nextinject-cta-sheen {
	0%, 54% {
		opacity: 0;
		transform: skewX(-16deg) translateX(-210%);
	}
	58% {
		opacity: 0.78;
	}
	72% {
		opacity: 0.56;
		transform: skewX(-16deg) translateX(430%);
	}
	78%, 100% {
		opacity: 0;
		transform: skewX(-16deg) translateX(520%);
	}
}

@keyframes nextinject-cta-sheen-core {
	0%, 55% {
		opacity: 0;
		transform: skewX(-16deg) translateX(-260%);
	}
	59% {
		opacity: 0.86;
	}
	71% {
		opacity: 0.62;
		transform: skewX(-16deg) translateX(1450%);
	}
	77%, 100% {
		opacity: 0;
		transform: skewX(-16deg) translateX(1560%);
	}
}

@media (prefers-reduced-motion: reduce) {
	body#body-public a.cta_AN.box::before,
	body#body-public a.cta_AN.box::after,
	body#body-public a.cta_RE.box::before,
	body#body-public a.cta_RE.box::after {
		animation: none !important;
		opacity: 0 !important;
	}
}
`;
			document.head.appendChild(style);
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
			document.querySelectorAll(`[data-nextinject-owner="${this.instanceId}"]`).forEach((node) => {
				if (this.surface === 'public' && this.isPublicActionNode(node)) {
					return;
				}
				node.remove();
			});
			document.querySelectorAll('.nextinject-runtime-match').forEach((node) => node.classList.remove('nextinject-runtime-match'));
			document.body?.classList.remove('AN_open', 'RE_open', 'nextinject-offer-open', 'nextinject-invoice-open');
			document.querySelector('#header')?.classList.remove('gimmick_active');
			const provenExpert = document.querySelector('#ProvenExpert_widgetbar_container');
			if (provenExpert instanceof HTMLElement) {
				provenExpert.style.display = '';
			}
		}

		isPublicActionNode(node) {
			return node instanceof HTMLElement
				&& (
					node.classList.contains('nextinject-public-actions')
					|| node.matches('a.cta_AN.box, a.cta_RE.box')
				);
		}

		cleanupPublicActions(keepKind = null) {
			document.querySelectorAll([
				`.nextinject-public-actions[data-nextinject-owner="${this.instanceId}"]`,
				`a.cta_AN.box[data-nextinject-owner="${this.instanceId}"]`,
				`a.cta_RE.box[data-nextinject-owner="${this.instanceId}"]`,
			].join(', ')).forEach((node) => {
				const isModern = node.classList.contains('nextinject-public-actions');
				const isLegacy = node.matches('a.cta_AN.box, a.cta_RE.box');
				if ((keepKind === 'modern' && isModern) || (keepKind === 'legacy' && isLegacy)) {
					return;
				}
				node.remove();
			});
		}

		getContextLabel() {
			const candidates = [
				document.querySelector('#header .header-title'),
				document.querySelector('#header .header-appname'),
				document.querySelector('.public-page__heading'),
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
				this.cleanupPublicActions();
				return;
			}

			const presetKey = activeRule.badge?.key || activeRule.badgePreset || '';
			if (presetKey === 'angebot' || presetKey === 'rechnung') {
				this.cleanupPublicActions('legacy');
				this.injectLegacyThemeCta(headerHost, activeRule, publicContext);
				return;
			}

			this.cleanupPublicActions('modern');

			const wrapper = document.querySelector(`.nextinject-public-actions[data-nextinject-owner="${this.instanceId}"]`)
				|| document.createElement('div');
			wrapper.className = 'nextinject-public-actions';
			wrapper.dataset.nextinjectOwner = this.instanceId;

			const link = wrapper.querySelector('a.nextinject-public-action') || document.createElement('a');
			link.className = `nextinject-public-action nextinject-public-action--${activeRule.headerAction.variant || 'secondary'}`;
			link.href = this.resolveActionUrl(activeRule.headerAction.url, {
				contextLabel,
				fileName: publicContext.activeViewerTitle || publicContext.dir,
			});
			link.target = '_blank';
			link.rel = 'noreferrer noopener';
			link.textContent = activeRule.headerAction.label;
			if (!link.parentElement) {
				wrapper.appendChild(link);
			}

			const publicPageMenu = headerHost.querySelector('#public-page-menu');
			if (publicPageMenu && wrapper.nextSibling !== publicPageMenu) {
				headerHost.insertBefore(wrapper, publicPageMenu);
			} else if (!wrapper.parentElement) {
				headerHost.appendChild(wrapper);
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
			const action = activeRule.headerAction;
			const existingLinks = Array.from(document.querySelectorAll([
				`a.cta_AN.box[data-nextinject-owner="${this.instanceId}"]`,
				`a.cta_RE.box[data-nextinject-owner="${this.instanceId}"]`,
			].join(', ')));
			const link = existingLinks.find((node) => node.parentElement === headerHost)
				|| existingLinks[0]
				|| document.createElement('a');
			existingLinks.filter((node) => node !== link).forEach((node) => node.remove());
			link.dataset.nextinjectOwner = this.instanceId;
			link.href = this.resolveActionUrl(action.url, context);
			link.target = '_blank';
			link.rel = 'noreferrer noopener';

			if (presetKey === 'angebot') {
				link.className = 'cta_AN box';
				const markup = `<i></i><span>${this.escape(action.label || 'Angebot bestätigen')}</span>`;
				if (link.innerHTML !== markup) {
					link.innerHTML = markup;
				}
			} else {
				link.className = 'cta_RE box zahlung';
				const markup = `<i></i><span>${this.escape(action.label || 'Zahlung mitteilen')}</span>`;
				if (link.innerHTML !== markup) {
					link.innerHTML = markup;
				}
			}

			const linkIsBeforeTarget = insertBeforeTarget
				&& link.parentElement === headerHost
				&& Boolean(link.compareDocumentPosition(insertBeforeTarget) & Node.DOCUMENT_POSITION_FOLLOWING);
			if (insertBeforeTarget && !linkIsBeforeTarget) {
				headerHost.insertBefore(link, insertBeforeTarget);
			} else if (!insertBeforeTarget && link.parentElement !== headerHost) {
				headerHost.appendChild(link);
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
