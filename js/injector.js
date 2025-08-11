// js/injector.js - Frontend Injector für Files App
(function() {
	'use strict';
	
	
	if (window.NextcloudElementInjector) {
		console.log('NextcloudElementInjector already exists, skipping initialization');
		return;
	}

	class NextcloudAppInjector {
		constructor() {
			this.targetConfigs = [];
			this.configLoaded = false;
			this.processedElements = new WeakSet();
			this.isInitialized = false;
			this.observer = null;
			this.retryCount = 0;
			this.maxRetries = 20;
			this.injectedCount = 0;
			
			this.instanceId = 'app_injector_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			
			console.log(`🚀 NextcloudAppInjector created (${this.instanceId})`);
			this.init();
		}

		async init() {
			if (document.body.hasAttribute('data-injector-active')) {
				console.log('❌ Another injector instance is already active');
				return;
			}

			document.body.setAttribute('data-injector-active', this.instanceId);
			
			// Konfiguration aus der App laden
			await this.loadConfigurationFromApp();
			
			// Mit normalem Ablauf fortfahren
			this.waitForContent();
		}

		async loadConfigurationFromApp() {
			console.log('🔧 Loading configuration from Nextcloud app...');
			
			try {
				const response = await fetch(OC.generateUrl('/apps/elementinjector/api/v1/config'), {
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
						console.log(`✅ Loaded ${this.targetConfigs.length} configurations from app`);
					} else {
						console.log('⚠️ No app config found, using fallback');
						this.targetConfigs = this.getFallbackConfig();
					}
				} else {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				
			} catch (error) {
				console.warn('⚠️ Failed to load app config, using fallback:', error);
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
			if (this.hasMinimalContent()) {
				console.log('✅ Files app content detected, starting injection...');
				this.startInjection();
			} else if (this.retryCount < this.maxRetries) {
				this.retryCount++;
				console.log(`⏳ Waiting for files content... (${this.retryCount}/${this.maxRetries})`);
				setTimeout(() => this.waitForContent(), 1000);
			} else {
				console.warn('⚠️ Max retries reached, starting anyway...');
				this.startInjection();
			}
		}

		hasMinimalContent() {
			const indicators = [
				document.querySelector('#app-content-files'),
				document.querySelector('.files-fileList'),
				document.querySelector('[data-file]'),
				document.querySelector('.app-files'),
				document.querySelectorAll('.nametext').length > 0
			];
			
			return indicators.some(indicator => indicator);
		}

		startInjection() {
			if (this.isInitialized) {
				console.log('⚠️ Already initialized, skipping...');
				return;
			}
			
			this.isInitialized = true;
			this.searchAndInject();
			this.setupUniqueObserver();

			console.log(`✅ NextcloudAppInjector active (${this.instanceId})`);
			
			// Auf Navigation in Files App hören
			this.setupNavigationListener();
		}

		setupNavigationListener() {
			// Nextcloud Files App Navigation Detection
			const originalPushState = history.pushState;
			const originalReplaceState = history.replaceState;
			
			const handleNavigation = () => {
				setTimeout(() => {
					console.log('📍 Navigation detected, re-injecting...');
					this.searchAndInject();
				}, 500);
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

			// Auch auf Hash-Änderungen hören
			window.addEventListener('hashchange', handleNavigation);
		}

		setupUniqueObserver() {
			if (document.body.hasAttribute('data-observer-active')) {
				console.log('📡 Observer already exists, skipping creation');
				return;
			}

			document.body.setAttribute('data-observer-active', 'true');

			this.observer = new MutationObserver((mutations) => {
				const relevantMutations = mutations.filter(mutation => {
					if (mutation.type === 'childList') {
						return Array.from(mutation.addedNodes).some(node => 
							node.nodeType === Node.ELEMENT_NODE && 
							(node.classList.contains('nametext') || 
							 node.querySelector('.nametext') ||
							 node.hasAttribute('data-file'))
						);
					}
					if (mutation.type === 'characterData') {
						const text = mutation.target.textContent;
						return this.targetConfigs.some(config => text.includes(config.text));
					}
					return false;
				});

				if (relevantMutations.length > 0) {
					this.throttledSearch();
				}
			});

			// Observer auf Files-spezifische Container beschränken
			const targetContainer = this.getFilesObserverTarget();
			
			this.observer.observe(targetContainer, {
				childList: true,
				subtree: true,
				characterData: true
			});

			console.log('📡 Files-specific MutationObserver started on:', targetContainer.tagName);
		}

		getFilesObserverTarget() {
			const containers = [
				'#app-content-files',
				'.files-fileList',
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
			}, 300); // Kürzeres Throttling für bessere UX
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
					console.log(`🔍 Files injection: ${foundElements} new elements found in ${duration.toFixed(2)}ms`);
				}
				
			} catch (error) {
				console.error('❌ Error in files searchAndInject:', error);
			}
		}

		processTargetConfig(config) {
			let count = 0;
			
			// Spezielle Suche für Files App - fokussiert auf Dateinamen
			const fileElements = document.querySelectorAll('.nametext');
			
			fileElements.forEach(fileElement => {
				const fileName = this.getFileName(fileElement);
				if (fileName && fileName.includes(config.text)) {
					if (this.shouldInject(fileElement, config.text)) {
						this.injectAfterElement(fileElement, config);
						this.processedElements.add(fileElement);
						count++;
					}
				}
			});
			
			return count;
		}

		getFileName(element) {
			// Verschiedene Wege den Dateinamen zu extrahieren
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
			const nameSpan = element.querySelector('.innernametext, .name, .filename');
			if (nameSpan) {
				return nameSpan.textContent.trim();
			}
			
			return '';
		}

		shouldInject(element, targetText) {
			if (!element || !element.parentNode) return false;
			
			if (this.processedElements.has(element)) return false;
			
			// Prüfe ob bereits ein injiziertes Element in der Nähe ist
			const parent = element.closest('tr, .file-row, .files-fileList li');
			if (parent && parent.querySelector('.nextcloud-injected-element')) {
				return false;
			}
			
			if (element.offsetParent === null) return false;
			
			if (element.closest('.nextcloud-injected-element')) return false;
			
			return true;
		}

		injectAfterElement(element, config) {
			const injectedDiv = document.createElement('span');
			injectedDiv.className = `${config.className} nextcloud-injected-element files-badge`;
			injectedDiv.setAttribute('data-injected-by', this.instanceId);
			injectedDiv.setAttribute('data-target-text', config.text);
			
			// Template einfügen
			injectedDiv.innerHTML = config.template;
			
			// Bessere Positionierung für Files App
			const insertTarget = this.findBestInsertionPoint(element);
			
			if (insertTarget.nextSibling) {
				insertTarget.parentNode.insertBefore(injectedDiv, insertTarget.nextSibling);
			} else {
				insertTarget.parentNode.appendChild(injectedDiv);
			}

			// Styling für Files App
			injectedDiv.style.marginLeft = '8px';
			injectedDiv.style.display = 'inline-block';
			injectedDiv.style.verticalAlign = 'middle';
			
			// Fade-in Animation
			injectedDiv.style.opacity = '0';
			injectedDiv.style.transform = 'scale(0.8)';
			injectedDiv.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
			
			requestAnimationFrame(() => {
				injectedDiv.style.opacity = '1';
				injectedDiv.style.transform = 'scale(1)';
			});

			this.injectedCount++;
			console.log(`✅ Files injection #${this.injectedCount} "${config.className}" after "${config.text}"`);
		}

		findBestInsertionPoint(element) {
			// Suche nach dem besten Einfügepunkt basierend auf Files App Struktur
			
			// Option 1: Direkt nach dem Dateinamen
			if (element.classList.contains('nametext')) {
				return element;
			}
			
			// Option 2: Nach dem Name-Container
			const nameContainer = element.closest('.name');
			if (nameContainer) {
				return nameContainer;
			}
			
			// Option 3: Nach dem Filename-Element
			const filenameElement = element.closest('.filename');
			if (filenameElement) {
				return filenameElement;
			}
			
			// Fallback: Das Element selbst
			return element;
		}

		// Konfiguration zur Laufzeit neu laden
		async reloadConfiguration() {
			console.log('🔄 Reloading configuration...');
			await this.loadConfigurationFromApp();
			this.searchAndInject();
		}

		destroy() {
			if (this.observer) {
				this.observer.disconnect();
			}
			
			if (this.searchTimeout) {
				clearTimeout(this.searchTimeout);
			}
			
			if (document.body.getAttribute('data-injector-active') === this.instanceId) {
				document.body.removeAttribute('data-injector-active');
				document.body.removeAttribute('data-observer-active');
			}
			
			// Alle injizierten Elemente entfernen
			document.querySelectorAll(`[data-injected-by="${this.instanceId}"]`).forEach(el => el.remove());
			
			console.log(`🧹 NextcloudAppInjector destroyed (${this.instanceId})`);
		}
	}

	// Singleton-Instanz erstellen (nur in Files App)
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			window.NextcloudElementInjector = new NextcloudAppInjector();
		});
	} else {
		window.NextcloudElementInjector = new NextcloudAppInjector();
	}

	// Cleanup bei Seitenwechsel
	window.addEventListener('beforeunload', () => {
		if (window.NextcloudElementInjector) {
			window.NextcloudElementInjector.destroy();
		}
	});

	// App-spezifisches Debug-Interface
	window.InjectorDebug = {
		getStats: () => {
			if (window.NextcloudElementInjector) {
				return {
					injectedCount: window.NextcloudElementInjector.injectedCount,
					targetConfigs: window.NextcloudElementInjector.targetConfigs,
					instanceId: window.NextcloudElementInjector.instanceId,
					configLoaded: window.NextcloudElementInjector.configLoaded
				};
			}
		},
		
		reloadConfig: async () => {
			if (window.NextcloudElementInjector) {
				await window.NextcloudElementInjector.reloadConfiguration();
				console.log('✅ Configuration reloaded from app');
			}
		},
		
		removeAllInjected: () => {
			document.querySelectorAll('.nextcloud-injected-element').forEach(el => el.remove());
			console.log('🧹 All injected elements removed');
		},

		testInjection: () => {
			if (window.NextcloudElementInjector) {
				window.NextcloudElementInjector.searchAndInject();
				console.log('🔍 Manual injection test triggered');
			}
		}
	};

})();