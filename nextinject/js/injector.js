// js/injector.js - Frontend Injector für Files App (NextInject)
(function() {
	'use strict';
	
	// Nur in der Files App laden
	if (!window.location.pathname.includes('/apps/files')) {
		return;
	}
	
	if (window.NextInjectInjector) {
		console.log('NextInjectInjector already exists, skipping initialization');
		return;
	}

	class NextInjectInjector {
		constructor() {
			this.targetConfigs = [];
			this.configLoaded = false;
			this.processedElements = new WeakSet();
			this.isInitialized = false;
			this.observer = null;
			this.retryCount = 0;
			this.maxRetries = 30;
			this.injectedCount = 0;
			this.settings = this.loadAdvancedSettings();
			
			this.instanceId = 'nextinject_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			
			console.log(`🚀 NextInjectInjector created (${this.instanceId})`);
			this.init();
		}

		loadAdvancedSettings() {
			try {
				const stored = localStorage.getItem('nextinject-advanced-settings');
				return stored ? JSON.parse(stored) : {
					injectionDelay: 300,
					caseSensitive: true,
					debugMode: false
				};
			} catch (error) {
				return {
					injectionDelay: 300,
					caseSensitive: true,
					debugMode: false
				};
			}
		}

		log(message) {
			if (this.settings.debugMode) {
				console.log('NextInject:', message);
			}
		}

		async init() {
			if (document.body.hasAttribute('data-nextinject-active')) {
				this.log('Another injector instance is already active');
				return;
			}

			document.body.setAttribute('data-nextinject-active', this.instanceId);
			
			// Konfiguration aus der Admin-App laden
			await this.loadConfigurationFromAdmin();
			
			// Mit dem Injection-Prozess beginnen
			this.waitForContent();
		}

		async loadConfigurationFromAdmin() {
			this.log('Loading configuration from NextInject admin...');
			
			try {
				const response = await fetch(OC.generateUrl('/apps/nextinject/api/v1/config'), {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'requesttoken': OC.requestToken
					},
					credentials: 'same-origin'
				});

				if (response.ok) {
					const data = await response.json();
					if (data.configs && data.configs.length > 0) {
						this.targetConfigs = data.configs.filter(cfg => cfg.enabled !== false);
						this.log(`Loaded ${this.targetConfigs.length} admin configurations`);
					} else {
						this.log('No admin config found, using fallback');
						this.targetConfigs = this.getFallbackConfig();
					}
				} else {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				
			} catch (error) {
				this.log('Failed to load admin config, using fallback: ' + error.message);
				this.targetConfigs = this.getFallbackConfig();
			}
			
			this.configLoaded = true;
		}

		getFallbackConfig() {
			return [
				{
					text: '_AN',
					template: '<span class="badge badge-info"><i class="fas fa-file-invoice"></i> Angebot</span>',
					className: 'kat-angebot',
					enabled: true
				}
			];
		}

		waitForContent() {
			if (this.hasFilesContent()) {
				this.log('Files app content detected, starting injection...');
				setTimeout(() => this.startInjection(), this.settings.injectionDelay);
			} else if (this.retryCount < this.maxRetries) {
				this.retryCount++;
				this.log(`Waiting for files content... (${this.retryCount}/${this.maxRetries})`);
				setTimeout(() => this.waitForContent(), 1000);
			} else {
				this.log('Max retries reached, starting anyway...');
				this.startInjection();
			}
		}

		hasFilesContent() {
			const indicators = [
				document.querySelector('#app-content-files'),
				document.querySelector('.files-fileList'),
				document.querySelector('[data-file]'),
				document.querySelector('.app-files'),
				document.querySelector('#fileList'),
				document.querySelectorAll('.nametext, .filename').length > 0
			];
			
			return indicators.some(indicator => indicator);
		}

		startInjection() {
			if (this.isInitialized) {
				this.log('Already initialized, skipping...');
				return;
			}
			
			this.isInitialized = true;
			this.searchAndInject();
			this.setupObserver();
			this.setupNavigationListener();

			this.log(`NextInjectInjector active with ${this.targetConfigs.length} configs`);
		}

		setupNavigationListener() {
			// Nextcloud Files App Navigation Detection
			const originalPushState = history.pushState;
			const originalReplaceState = history.replaceState;
			
			const handleNavigation = () => {
				setTimeout(() => {
					this.log('Navigation detected, re-injecting...');
					this.searchAndInject();
				}, this.settings.injectionDelay);
			};

			history.pushState = function(...args) {
				originalPushState.apply(history, args);
				handleNavigation();
			};

			history.replaceState = function(...args) {
				originalReplaceState.apply(history, args);
				handleNavigation();
			};

			window.addEventListener('popstate', handleNavigation);
			window.addEventListener('hashchange', handleNavigation);
		}

		setupObserver() {
			if (document.body.hasAttribute('data-nextinject-observer')) {
				this.log('Observer already exists, skipping creation');
				return;
			}

			document.body.setAttribute('data-nextinject-observer', 'true');

			this.observer = new MutationObserver((mutations) => {
				const relevantMutations = mutations.filter(mutation => {
					if (mutation.type === 'childList') {
						return Array.from(mutation.addedNodes).some(node => 
							node.nodeType === Node.ELEMENT_NODE && 
							(node.classList.contains('nametext') || 
							 node.querySelector('.nametext') ||
							 node.hasAttribute('data-file') ||
							 node.classList.contains('filename') ||
							 node.querySelector('.filename'))
						);
					}
					if (mutation.type === 'characterData') {
						const text = mutation.target.textContent;
						return this.targetConfigs.some(config => 
							this.settings.caseSensitive ? 
								text.includes(config.text) : 
								text.toLowerCase().includes(config.text.toLowerCase())
						);
					}
					return false;
				});

				if (relevantMutations.length > 0) {
					this.throttledSearch();
				}
			});

			// Observer auf Files-spezifische Container beschränken
			const targetContainer = this.getObserverTarget();
			
			this.observer.observe(targetContainer, {
				childList: true,
				subtree: true,
				characterData: true
			});

			this.log(`Observer started on: ${targetContainer.tagName}${targetContainer.id ? '#' + targetContainer.id : ''}`);
		}

		getObserverTarget() {
			const containers = [
				'#app-content-files',
				'.files-fileList',
				'#fileList',
				'#app-content',
				'#app',
				'body'
			];

			for (const selector of containers) {
				const element = document.querySelector(selector);
				if (element) {
					return element;
				}
			}
			
			return document.body;
		}

		throttledSearch() {
			if (this.searchTimeout) {
				clearTimeout(this.searchTimeout);
			}
			
			this.searchTimeout = setTimeout(() => {
				this.searchAndInject();
			}, 200); // Schnelleres Throttling für bessere UX
		}

		searchAndInject() {
			const startTime = performance.now();
			let foundElements = 0;

			try {
				this.targetConfigs.forEach(config => {
					if (config.enabled !== false) {
						foundElements += this.processTargetConfig(config);
					}
				});

				const duration = performance.now() - startTime;
				if (foundElements > 0) {
					this.log(`Injection completed: ${foundElements} new elements in ${duration.toFixed(2)}ms`);
				}
				
			} catch (error) {
				console.error('NextInject searchAndInject error:', error);
			}
		}

		processTargetConfig(config) {
			let count = 0;
			
			// Multi-Selector für verschiedene Nextcloud-Versionen
			const selectors = [
				'.nametext',           // Standard Files App
				'.filename',           // Alternative Darstellung
				'[data-file]',         // Data-Attribute
				'.files-list .name',   // Neuere Versionen
				'.file-row .filename', // Grid View
				'td.filename'          // Table View
			];
			
			selectors.forEach(selector => {
				const fileElements = document.querySelectorAll(selector);
				
				fileElements.forEach(fileElement => {
					const fileName = this.getFileName(fileElement);
					const matches = this.settings.caseSensitive ? 
						fileName.includes(config.text) : 
						fileName.toLowerCase().includes(config.text.toLowerCase());
						
					if (fileName && matches) {
						if (this.shouldInject(fileElement, config.text)) {
							this.injectAfterElement(fileElement, config);
							this.processedElements.add(fileElement);
							count++;
						}
					}
				});
			});
			
			return count;
		}

		getFileName(element) {
			// Verschiedene Methoden den Dateinamen zu extrahieren
			if (element.textContent) {
				return element.textContent.trim();
			}
			
			if (element.title) {
				return element.title;
			}
			
			const dataFile = element.getAttribute('data-file');
			if (dataFile) {
				return dataFile;
			}
			
			// Suche in Kind-Elementen
			const nameSpan = element.querySelector('.innernametext, .name, .filename, a');
			if (nameSpan) {
				return nameSpan.textContent.trim();
			}
			
			// Suche in Parent-Elementen für data-file
			const parent = element.closest('[data-file]');
			if (parent) {
				return parent.getAttribute('data-file');
			}
			
			return '';
		}

		shouldInject(element, targetText) {
			if (!element || !element.parentNode) return false;
			
			if (this.processedElements.has(element)) return false;
			
			// Prüfe auf bereits vorhandene Badges in der Zeile/Container
			const container = element.closest('tr, .file-row, .files-fileList li, .file-list-item');
			if (container && container.querySelector('.nextinject-badge')) {
				return false;
			}
			
			if (element.offsetParent === null) return false;
			
			if (element.closest('.nextinject-badge')) return false;
			
			return true;
		}

		injectAfterElement(element, config) {
			const injectedSpan = document.createElement('span');
			injectedSpan.className = `${config.className} nextinject-badge`;
			injectedSpan.setAttribute('data-injected-by', this.instanceId);
			injectedSpan.setAttribute('data-target-text', config.text);
			injectedSpan.setAttribute('title', config.description || config.text);
			
			// Template einfügen
			injectedSpan.innerHTML = config.template;
			
			// Beste Einfügungsposition finden
			const insertTarget = this.findBestInsertionPoint(element);
			
			if (insertTarget.nextSibling) {
				insertTarget.parentNode.insertBefore(injectedSpan, insertTarget.nextSibling);
			} else {
				insertTarget.parentNode.appendChild(injectedSpan);
			}

			// Styling für Files App
			this.styleInjectedElement(injectedSpan);
			
			// Animation
			this.animateInjection(injectedSpan);

			this.injectedCount++;
			this.log(`Injected #${this.injectedCount} "${config.className}" for "${config.text}"`);
		}

		findBestInsertionPoint(element) {
			// Verschiedene Einfügungsstrategien je nach Nextcloud-Version
			
			// Strategie 1: Nach dem Dateinamen-Link
			const nameLink = element.querySelector('a') || element.closest('a');
			if (nameLink) {
				return nameLink;
			}
			
			// Strategie 2: Nach dem Name-Container
			if (element.classList.contains('nametext') || element.classList.contains('filename')) {
				return element;
			}
			
			// Strategie 3: In der Name-Zelle (Table View)
			const nameCell = element.closest('td.filename, .name-cell');
			if (nameCell) {
				const lastChild = nameCell.querySelector('.nametext, .filename, a') || nameCell;
				return lastChild;
			}
			
			// Fallback: Das Element selbst
			return element;
		}

		styleInjectedElement(element) {
			element.style.marginLeft = '8px';
			element.style.display = 'inline-block';
			element.style.verticalAlign = 'middle';
			element.style.fontSize = '11px';
			element.style.lineHeight = '1.2';
		}

		animateInjection(element) {
			element.style.opacity = '0';
			element.style.transform = 'scale(0.8)';
			element.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
			
			requestAnimationFrame(() => {
				element.style.opacity = '1';
				element.style.transform = 'scale(1)';
			});
		}

		// Public methods für Debug/Management
		async reloadConfiguration() {
			this.log('Reloading configuration...');
			await this.loadConfigurationFromAdmin();
			this.searchAndInject();
		}

		getStatistics() {
			return {
				injectedCount: this.injectedCount,
				targetConfigs: this.targetConfigs.length,
				enabledConfigs: this.targetConfigs.filter(c => c.enabled).length,
				instanceId: this.instanceId,
				configLoaded: this.configLoaded,
				settings: this.settings
			};
		}

		removeAllInjected() {
			const injected = document.querySelectorAll('.nextinject-badge');
			injected.forEach(el => el.remove());
			this.log(`Removed ${injected.length} injected elements`);
			this.injectedCount = 0;
			this.processedElements = new WeakSet();
		}

		destroy() {
			if (this.observer) {
				this.observer.disconnect();
			}
			
			if (this.searchTimeout) {
				clearTimeout(this.searchTimeout);
			}
			
			if (document.body.getAttribute('data-nextinject-active') === this.instanceId) {
				document.body.removeAttribute('data-nextinject-active');
				document.body.removeAttribute('data-nextinject-observer');
			}
			
			// Alle von dieser Instanz erstellten Elemente entfernen
			document.querySelectorAll(`[data-injected-by="${this.instanceId}"]`).forEach(el => el.remove());
			
			this.log(`NextInjectInjector destroyed`);
		}
	}

	// Instanz erstellen
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			window.NextInjectInjector = new NextInjectInjector();
		});
	} else {
		window.NextInjectInjector = new NextInjectInjector();
	}

	// Cleanup bei Seitenwechsel
	window.addEventListener('beforeunload', () => {
		if (window.NextInjectInjector) {
			window.NextInjectInjector.destroy();
		}
	});

	// Public Debug Interface
	window.NextInjectDebug = {
		getStats: () => window.NextInjectInjector?.getStatistics(),
		reloadConfig: () => window.NextInjectInjector?.reloadConfiguration(),
		removeAll: () => window.NextInjectInjector?.removeAllInjected(),
		testInjection: () => window.NextInjectInjector?.searchAndInject(),
		destroy: () => window.NextInjectInjector?.destroy()
	};

})();