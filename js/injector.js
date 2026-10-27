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
	const contextNameSelector = [
		'title', '.kunde-name', '#header .header-title', '#header .header-appname',
		'.public-page__heading', '#nextcloud', '#content > h1',
		'#viewer .modal-header__name', '#viewer .viewer__title', '#viewer h2',
		'.files-list__row-name-text', '.files-list__row-name-link', 'td.filename',
		'tr[data-file] .name', '.files-filestable .name',
	].join(', ');
	const contextStructureSelector = [
		contextNameSelector, '#content', '#app-content', '#viewer', '#header',
		'#header .header-end', '#header .header-right', '#header-primary-action', '#public-page-menu',
		'meta[property="og:title"]', '.files-list__row', '[data-cy-files-list-row]',
		'tr[data-file]', '.files-filestable', '[data-nextinject-file-name]', '[data-nextinject-badge-host]',
	].join(', ');

	class NextInjectRuntime {
		constructor() {
			this.surface = surface;
			this.rules = [];
			this.settings = { injectionDelay: 180, debugMode: false };
			this.scanTimer = null;
			this.observer = null;
			this.themeContext = null;
			this.lastUpdateSignature = '';
			this.forceUpdate = false;
			this.originalWidgetDisplay = null;
			this.instanceId = `nextinject-${Date.now()}`;
		}

		log(...args) {
			if (this.settings.debugMode) {
				console.log('[NextInject]', ...args);
			}
		}

		async init() {
			// Capture theme context while the read-only configuration request is in flight.
			this.setupContextListener();
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
			const navigate = () => {
				this.themeContext = null;
				this.scheduleScan();
			};
			window.addEventListener('hashchange', navigate);
			window.addEventListener('popstate', navigate);
			window.addEventListener('load', () => this.scheduleScan());
		}

		setupContextListener() {
			window.addEventListener('nextinject:context-changed', (event) => {
				const detail = event.detail;
				if (detail?.reset === true) {
					this.themeContext = null;
				} else if (typeof detail?.viewerOpen === 'boolean' || typeof detail?.fileName === 'string' || detail?.fileName === null) {
					this.themeContext = {
						viewerOpen: typeof detail.viewerOpen === 'boolean' ? detail.viewerOpen : typeof detail.fileName === 'string',
						fileName: typeof detail.fileName === 'string' ? detail.fileName.trim() : '',
						dir: typeof detail.dir === 'string' ? detail.dir : undefined,
						contextLabel: typeof detail.contextLabel === 'string' ? detail.contextLabel.trim() : undefined,
					};
				}
				this.forceUpdate = true;
				this.scheduleScan();
			});
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
			this.observer.observe(target, {
				childList: true, subtree: true, characterData: true, attributes: true,
				attributeFilter: ['data-nextinject-file-name', 'data-nextinject-badge-host',
					'data-cy-files-list-row-name', 'data-file', 'content', 'class', 'style', 'hidden', 'aria-hidden'],
			});
		}

		isExternalMutation(mutation) {
			if (this.isOwnedMutationNode(mutation.target)) {
				return false;
			}
			if (mutation.type === 'attributes') {
				// Ignore our own body/header classes and unrelated theme animations.
				return ['data-nextinject-file-name', 'data-nextinject-badge-host', 'data-cy-files-list-row-name', 'data-file'].includes(mutation.attributeName)
					|| Boolean(mutation.target.matches?.('#viewer, #viewer .modal-wrapper, meta[property="og:title"]'));
			}
			if (mutation.type === 'characterData') {
				return Boolean(mutation.target.parentElement?.closest(contextNameSelector));
			}

			return [...mutation.addedNodes, ...mutation.removedNodes]
				.some((node) => !this.isOwnedMutationNode(node) && (
					Boolean(mutation.target.closest?.(contextNameSelector))
					|| (node instanceof Element && (node.matches(contextStructureSelector) || node.querySelector(contextStructureSelector)))
				));
		}

		isOwnedMutationNode(node) {
			if (node?.nodeType === Node.TEXT_NODE) {
				return this.isOwnedMutationNode(node.parentElement);
			}
			if (!(node instanceof Element)) {
				return false;
			}

			return node.id === 'nextinject-legacy-theme-fixes'
				|| node.dataset.nextinjectOwner === this.instanceId
				|| Boolean(node.closest?.(`[data-nextinject-owner="${this.instanceId}"], #nextinject-legacy-theme-fixes`));
		}

		getObserverTarget() {
			// Vue replaces #content and teleports the viewer outside it. The document
			// root also catches title updates without polling or reattaching observers.
			return document.documentElement
				|| document.body;
		}

		patchHistory() {
			if (window.__nextInjectHistoryPatched) {
				return;
			}

			window.__nextInjectHistoryPatched = true;
			const trigger = () => {
				this.themeContext = null;
				this.scheduleScan();
			};
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
			if (this.scanTimer !== null) {
				return;
			}
			this.scanTimer = window.setTimeout(() => {
				this.scanTimer = null;
				this.scan();
			}, this.settings.injectionDelay ?? 180);
		}

		scan() {
			this.scanChanged = false;
			const contextLabel = this.getContextLabel();
			const fileTargets = this.getFileTargets();
			const applicableRules = this.rules
				.filter((rule) => rule.enabled !== false && Array.isArray(rule.surfaces) && rule.surfaces.includes(this.surface))
				.sort((a, b) => (b.priority || 0) - (a.priority || 0));
			const badges = new Set();
			const hosts = new Set();
			const matches = [];

			if (this.surface === 'files' || this.surface === 'public') {
				fileTargets.forEach((target) => {
					const matchingRule = applicableRules.find((rule) => this.matches(target.name, rule.matcher));
					if (matchingRule) {
						const result = this.injectBadge(target, matchingRule);
						if (result) {
							badges.add(result.badge);
							hosts.add(result.host);
							matches.push({ fileName: target.name, ruleId: matchingRule.id });
						}
					}
				});
			}

			this.cleanup(badges, hosts);
			const publicContext = this.surface === 'public' ? this.getPublicContext(contextLabel) : null;
			const activePublicRule = publicContext ? applicableRules.find((rule) =>
					rule.surfaces.includes('public') && this.contextMatchesRule(publicContext, rule)
				) || null : null;

			if (publicContext) {
				this.applyPublicThemeState(activePublicRule);
				this.injectPublicActions(publicContext.contextLabel, activePublicRule, publicContext);
			}
			const action = activePublicRule?.headerAction;
			const detail = {
				surface: this.surface,
				context: publicContext ? { ...publicContext, viewerOpen: this.getViewerContext().viewerOpen } : null,
				activeRule: activePublicRule ? {
					id: activePublicRule.id,
					badgePreset: activePublicRule.badge?.key || activePublicRule.badgePreset || '',
				} : null,
				actions: action && action.enabled !== false ? [{
					label: action.label,
					url: this.resolveActionUrl(action.url, publicContext),
					variant: action.variant || 'secondary',
				}] : [],
				badgeCount: badges.size,
			};
			const signature = JSON.stringify({ ...detail, matches });
			if (this.forceUpdate || this.scanChanged || signature !== this.lastUpdateSignature) {
				this.forceUpdate = false;
				this.lastUpdateSignature = signature;
				window.dispatchEvent(new CustomEvent('nextinject:updated', { detail }));
			}
		}

		cleanup(badges, hosts) {
			document.querySelectorAll(`.nextinject-badge[data-nextinject-owner="${this.instanceId}"]`).forEach((node) => {
				if (!badges.has(node)) {
					node.remove();
					this.scanChanged = true;
				}
			});
			document.querySelectorAll('.nextinject-runtime-match').forEach((node) => {
				if (!hosts.has(node)) {
					node.classList.remove('nextinject-runtime-match');
				}
			});
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
			// Files replaces document.title when its viewer closes. The server-rendered
			// share name stays stable and must not disappear with that transient title.
			if (this.surface === 'public') {
				const shareName = document.querySelector('.kunde-name')?.textContent?.trim()
					|| document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
				if (shareName) {
					return shareName;
				}
			}

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
			const targets = this.getThemeFileTargets();
			const themeRows = targets.map(({ row }) => row);
			const seen = new Set(themeRows);
			for (const target of [...this.getModernFileTargets(), ...this.getLegacyFileTargets()]) {
				if (!seen.has(target.row) && !themeRows.some((row) => row.contains(target.row) || target.row.contains(row))) {
					seen.add(target.row);
					targets.push(target);
				}
			}
			return targets;
		}

		getThemeFileTargets() {
			return Array.from(document.querySelectorAll('[data-nextinject-file-name]')).flatMap((row) => {
				const name = row.getAttribute('data-nextinject-file-name')?.trim();
				// Explicit hosts keep badges out of unrelated theme text and controls.
				if (!name) {
					return [];
				}
				return Array.from(row.querySelectorAll('[data-nextinject-badge-host]'))
					.filter((badgeHost) => badgeHost.closest('[data-nextinject-file-name]') === row)
					.map((badgeHost) => ({ row, node: badgeHost, badgeHost, name }));
			});
		}

		getModernFileTargets() {
			const rows = Array.from(document.querySelectorAll('.files-list__row, [data-cy-files-list-row]'));
			const targets = [];

			rows.forEach((row) => {
				if (!(row instanceof HTMLElement)) {
					return;
				}

				const nameText = row.querySelector('.files-list__row-name-text');
				const node = nameText
					|| row.querySelector('.files-list__row-name-link')
					|| row.querySelector('[data-cy-files-list-row-name]');
				if (!(node instanceof HTMLElement)) {
					return;
				}

				const extension = row.querySelector('.files-list__row-name-extension');
				const baseName = nameText?.textContent?.trim() || '';
				const extensionText = extension?.textContent?.trim() || '';
				const visibleName = nameText ? baseName + (extension && !nameText.contains(extension) ? extensionText : '') : '';
				const name = String(row.dataset.cyFilesListRowName
					|| node.getAttribute('data-cy-files-list-row-name')
					|| visibleName || this.getUnbadgedText(node)).trim();
				if (!name) {
					return;
				}
				targets.push({ node, name, row });
			});

			return targets;
		}

		getLegacyFileTargets() {
			const rows = Array.from(document.querySelectorAll('tr[data-file], .files-filestable tbody tr'));
			const targets = [];

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

				const rawName = String(row.getAttribute('data-file') || this.getUnbadgedText(node)).trim();
				const name = rawName.replace(/\s+/g, ' ');
				if (!name) {
					return;
				}

				targets.push({ node, name, row });
			});

			return targets;
		}

		getUnbadgedText(node) {
			const clone = node.cloneNode(true);
			clone.querySelectorAll('.nextinject-badge').forEach((badge) => badge.remove());
			return clone.textContent || '';
		}

		getViewerContext() {
			if (this.themeContext) {
				return this.themeContext;
			}
			const viewer = document.querySelector('#viewer');
			const style = viewer ? window.getComputedStyle(viewer) : null;
			const viewerOpen = Boolean(viewer && style?.display !== 'none'
				&& style?.visibility !== 'hidden' && viewer.offsetHeight > 0
				&& viewer.getAttribute?.('aria-hidden') !== 'true');
			const fileName = viewerOpen ? [
				viewer.querySelector('.modal-header__name'),
				viewer.querySelector('.viewer__title'),
				viewer.querySelector('h2'),
			].map((node) => node?.textContent?.trim()).find(Boolean) || document.title.trim() : '';
			return { viewerOpen, fileName };
		}

		getPublicContext(contextLabel) {
			const params = new URLSearchParams(window.location.search);
			// URLSearchParams has already decoded the path. A second decode loses
			// literal percent escapes and throws for valid names such as "100%".
			const dir = this.themeContext?.dir ?? params.get('dir') ?? '';
			contextLabel = this.themeContext?.contextLabel ?? contextLabel;
			const { viewerOpen, fileName } = this.getViewerContext();
			const activeViewerTitle = viewerOpen ? fileName : '';
			const currentDirectory = dir.split('/').filter(Boolean).at(-1) || '';
			// Only the displayed file, current directory, or root share may choose
			// an action. Never let an _AN parent/breadcrumb override an _RE file.
			const activeContextLabel = (viewerOpen ? activeViewerTitle : currentDirectory || contextLabel).trim();

			return {
				contextLabel: activeContextLabel,
				dir,
				activeViewerTitle,
				fileName: activeContextLabel,
				tokens: activeContextLabel ? [activeContextLabel] : [],
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
			const host = target.badgeHost || this.resolveBadgeHost(target.node);
			if (!host) {
				return;
			}

			const existing = target.badgeHost ? Array.from(host.children).find((node) =>
				node.classList.contains('nextinject-badge') && node.dataset.nextinjectOwner === this.instanceId
			) : host.nextElementSibling;
			const badge = existing?.classList.contains('nextinject-badge')
				&& existing.dataset.nextinjectOwner === this.instanceId ? existing : document.createElement('span');
			const className = `nextinject-badge ${rule.badge.className || ''}`;
			const iconText = rule.badge.icon || '';
			const labelText = rule.badge.text || rule.label;
			if (badge.className !== className || badge.dataset.nextinjectRule !== rule.id
				|| badge.children.length !== 2 || badge.firstElementChild?.textContent !== iconText
				|| badge.lastElementChild?.textContent !== labelText) {
				badge.className = className;
				badge.dataset.nextinjectOwner = this.instanceId;
				badge.dataset.nextinjectRule = rule.id;
				const icon = document.createElement('span');
				icon.className = 'nextinject-badge__icon';
				icon.textContent = iconText;
				const label = document.createElement('span');
				label.textContent = labelText;
				badge.replaceChildren(icon, label);
				this.scanChanged = true;
			}
			if (!badge.parentElement) {
				if (target.badgeHost) {
					host.appendChild(badge);
				} else {
					host.insertAdjacentElement('afterend', badge);
				}
				this.scanChanged = true;
			}
			if (!host.classList.contains('nextinject-runtime-match')) {
				host.classList.add('nextinject-runtime-match');
			}
			return { badge, host };
		}

		resolveBadgeHost(node) {
			const modernRow = node.closest?.('.files-list__row, [data-cy-files-list-row]');
			const modernNameText = modernRow?.querySelector?.('.files-list__row-name-text');
			if (modernNameText) {
				const extension = modernRow.querySelector('.files-list__row-name-extension');
				if (extension && !modernNameText.contains(extension) && extension.parentElement === modernNameText.parentElement) {
					return extension;
				}
				return modernNameText;
			}
			if (modernRow) {
				return modernRow.querySelector('.files-list__row-name-link') || node;
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

			if (!activeRule?.headerAction || activeRule.headerAction.enabled === false) {
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
				fileName: publicContext.fileName,
			});
			link.target = '_blank';
			link.rel = 'noreferrer noopener';
			if (link.textContent !== activeRule.headerAction.label) {
				link.textContent = activeRule.headerAction.label;
			}
			if (!link.parentElement) {
				wrapper.appendChild(link);
			}

			const publicPageMenu = this.getDirectHeaderAnchor(headerHost, '#public-page-menu');
			if (publicPageMenu && wrapper.nextSibling !== publicPageMenu) {
				headerHost.insertBefore(wrapper, publicPageMenu);
			} else if (wrapper.parentElement !== headerHost) {
				headerHost.appendChild(wrapper);
			}
		}

		getDirectHeaderAnchor(headerHost, selector) {
			let anchor = headerHost.querySelector(selector);
			while (anchor && anchor.parentElement !== headerHost) {
				anchor = anchor.parentElement;
			}
			return anchor;
		}

		injectLegacyThemeCta(headerHost, activeRule, publicContext) {
			const presetKey = activeRule.badge?.key || activeRule.badgePreset || '';
			const insertBeforeTarget = this.getDirectHeaderAnchor(headerHost, '#header-primary-action')
				|| this.getDirectHeaderAnchor(headerHost, '#public-page-menu')
				|| null;
			const context = {
				contextLabel: publicContext.contextLabel,
				fileName: publicContext.fileName,
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

		applyPublicThemeState(activeRule) {
			const presetKey = activeRule?.badge?.key || activeRule?.badgePreset || '';
			const body = document.body;
			const header = document.querySelector('#header');
			const provenExpert = document.querySelector('#ProvenExpert_widgetbar_container');

			body?.classList.toggle('AN_open', presetKey === 'angebot');
			body?.classList.toggle('nextinject-offer-open', presetKey === 'angebot');
			body?.classList.toggle('RE_open', presetKey === 'rechnung');
			body?.classList.toggle('nextinject-invoice-open', presetKey === 'rechnung');
			header?.classList.toggle('gimmick_active', presetKey === 'angebot');

			if (provenExpert instanceof HTMLElement) {
				if (presetKey === 'angebot' || presetKey === 'rechnung') {
					this.originalWidgetDisplay ??= provenExpert.style.display;
					if (provenExpert.style.display !== 'block') {
						provenExpert.style.display = 'block';
					}
				} else if (this.originalWidgetDisplay !== null) {
					provenExpert.style.display = this.originalWidgetDisplay;
					this.originalWidgetDisplay = null;
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
