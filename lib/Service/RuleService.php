<?php
declare(strict_types=1);

namespace OCA\NextInject\Service;

use OCP\IConfig;
use OCP\IUserManager;

class RuleService {
	private const CONFIG_RULES = 'rules';
	private const CONFIG_SETTINGS = 'settings';
	private const CONFIG_LAST_MODIFIED = 'last_modified';
	private const CONFIG_SCHEMA = 'schema_version';
	private const CONFIG_MIGRATED_FROM = 'migrated_from';

	public function __construct(
		private readonly IConfig $config,
		private readonly IUserManager $userManager,
	) {
	}

	public function getAdminPayload(?string $currentUserId = null): array {
		$this->ensureMigrated($currentUserId);

		$rules = $this->loadRules();
		$settings = $this->loadSettings();
		$presets = $this->getBadgePresets();

		return [
			'appId' => 'nextinject',
			'version' => '2.0.0',
			'rules' => $rules,
			'settings' => $settings,
			'presets' => $presets,
			'stats' => $this->buildStats($rules),
			'meta' => [
				'schemaVersion' => (int)$this->config->getAppValue('nextinject', self::CONFIG_SCHEMA, '2'),
				'migratedFrom' => $this->config->getAppValue('nextinject', self::CONFIG_MIGRATED_FROM, ''),
			],
		];
	}

	public function getFrontendPayload(?string $currentUserId = null): array {
		$this->ensureMigrated($currentUserId);

		$presets = $this->getBadgePresets();
		$rules = array_values(array_filter(array_map(function (array $rule) use ($presets): ?array {
			if (!($rule['enabled'] ?? false)) {
				return null;
			}

			$presetKey = $rule['badgePreset'];
			if (!isset($presets[$presetKey])) {
				return null;
			}

			return [
				'id' => $rule['id'],
				'label' => $rule['label'],
				'description' => $rule['description'],
				'priority' => $rule['priority'],
				'matcher' => $rule['matcher'],
				'surfaces' => $rule['surfaces'],
				'badge' => $presets[$presetKey],
				'headerAction' => $rule['headerAction'],
			];
		}, $this->loadRules())));

		usort($rules, static fn(array $a, array $b): int => $b['priority'] <=> $a['priority']);

		return [
			'appId' => 'nextinject',
			'rules' => $rules,
			'settings' => $this->loadSettings(),
			'generatedAt' => gmdate(DATE_ATOM),
		];
	}

	public function saveAdminState(array $payload, ?string $currentUserId = null): array {
		$rules = $this->sanitizeRules($payload['rules'] ?? []);
		$settings = $this->sanitizeSettings($payload['settings'] ?? []);

		$this->persistState($rules, $settings);

		return $this->getAdminPayload($currentUserId);
	}

	public function deleteRule(string $id, ?string $currentUserId = null): array {
		$payload = $this->getAdminPayload($currentUserId);
		$rules = array_values(array_filter($payload['rules'], static fn(array $rule): bool => $rule['id'] !== $id));
		return $this->saveAdminState([
			'rules' => $rules,
			'settings' => $payload['settings'],
		], $currentUserId);
	}

	public function resetToDefaults(?string $currentUserId = null): array {
		return $this->saveAdminState([
			'rules' => $this->defaultRules(),
			'settings' => $this->defaultSettings(),
		], $currentUserId);
	}

	public function importState(array $payload, ?string $currentUserId = null): array {
		return $this->saveAdminState($payload, $currentUserId);
	}

	public function exportState(?string $currentUserId = null): array {
		$payload = $this->getAdminPayload($currentUserId);

		return [
			'exportedAt' => gmdate(DATE_ATOM),
			'appId' => 'nextinject',
			'schemaVersion' => 2,
			'rules' => $payload['rules'],
			'settings' => $payload['settings'],
		];
	}

	private function ensureMigrated(?string $currentUserId): void {
		$existingRules = $this->config->getAppValue('nextinject', self::CONFIG_RULES, '');
		if ($existingRules !== '') {
			return;
		}

		$legacySource = '';
		$legacyRules = [];

		$currentNextinject = $this->decodeJson($this->config->getAppValue('nextinject', 'admin_targets', ''));
		if ($currentNextinject !== []) {
			$legacySource = 'nextinject.admin_targets';
			$legacyRules = $this->convertLegacyConfigs($currentNextinject);
		}

		if ($legacyRules === []) {
			$legacyElementApp = $this->decodeJson($this->config->getAppValue('elementinjector', 'admin_targets', ''));
			if ($legacyElementApp !== []) {
				$legacySource = 'elementinjector.admin_targets';
				$legacyRules = $this->convertLegacyConfigs($legacyElementApp);
			}
		}

		if ($legacyRules === []) {
			[$legacyRules, $legacySource] = $this->discoverLegacyUserRules($currentUserId);
		}

		$this->persistState(
			$legacyRules !== [] ? $legacyRules : $this->defaultRules(),
			$this->defaultSettings()
		);
		$this->config->setAppValue('nextinject', self::CONFIG_MIGRATED_FROM, $legacySource !== '' ? $legacySource : 'defaults');
	}

	private function loadRules(): array {
		$raw = $this->decodeJson($this->config->getAppValue('nextinject', self::CONFIG_RULES, ''));
		return $raw !== [] ? $this->sanitizeRules($raw) : $this->defaultRules();
	}

	private function loadSettings(): array {
		$raw = $this->decodeJson($this->config->getAppValue('nextinject', self::CONFIG_SETTINGS, ''));
		return $this->sanitizeSettings($raw);
	}

	private function sanitizeRules(array $rules): array {
		$presets = $this->getBadgePresets();
		$normalized = [];
		$usedIds = [];

		foreach (array_values($rules) as $index => $rule) {
			if (!is_array($rule)) {
				continue;
			}

			$preset = isset($rule['badgePreset']) && isset($presets[(string)$rule['badgePreset']])
				? (string)$rule['badgePreset']
				: $this->inferPreset($rule);

			$matcherValue = $this->sanitizeText(
				(string)($rule['matcher']['value'] ?? $rule['matcher']['pattern'] ?? $rule['text'] ?? '')
			);
			if ($matcherValue === '') {
				continue;
			}

			$id = $this->sanitizeIdentifier((string)($rule['id'] ?? ''));
			if ($id === '') {
				$id = $this->sanitizeIdentifier(sprintf('%s-%s-%d', $preset, preg_replace('/[^a-z0-9]+/i', '-', strtolower($matcherValue)) ?? 'rule', $index));
			}
			while (isset($usedIds[$id])) {
				$id .= '-x';
			}
			$usedIds[$id] = true;

			$surfaces = array_values(array_unique(array_filter(array_map(
				static fn($surface) => in_array($surface, ['files', 'public'], true) ? $surface : null,
				(array)($rule['surfaces'] ?? ['files', 'public'])
			))));
			if ($surfaces === []) {
				$surfaces = ['files', 'public'];
			}

			$normalized[] = [
				'id' => $id,
				'enabled' => (bool)($rule['enabled'] ?? true),
				'label' => $this->sanitizeText((string)($rule['label'] ?? $presets[$preset]['label'] ?? 'Regel'), 100),
				'matcher' => [
					'type' => 'substring',
					'value' => $matcherValue,
					'caseSensitive' => (bool)($rule['matcher']['caseSensitive'] ?? $rule['caseSensitive'] ?? true),
				],
				'surfaces' => $surfaces,
				'badgePreset' => $preset,
				'headerAction' => $this->sanitizeHeaderAction(is_array($rule['headerAction'] ?? null) ? $rule['headerAction'] : []),
				'description' => $this->sanitizeText((string)($rule['description'] ?? $presets[$preset]['description'] ?? ''), 180),
				'priority' => max(0, min(999, (int)($rule['priority'] ?? ($presets[$preset]['defaultPriority'] ?? 100)))),
			];
		}

		usort($normalized, static fn(array $a, array $b): int => $b['priority'] <=> $a['priority']);

		return $normalized;
	}

	private function sanitizeSettings(array $settings): array {
		$defaults = $this->defaultSettings();

		return [
			'injectionDelay' => max(0, min(5000, (int)($settings['injectionDelay'] ?? $defaults['injectionDelay']))),
			'debugMode' => (bool)($settings['debugMode'] ?? $defaults['debugMode']),
		];
	}

	private function persistState(array $rules, array $settings): void {
		$this->config->setAppValue('nextinject', self::CONFIG_RULES, json_encode($rules, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
		$this->config->setAppValue('nextinject', self::CONFIG_SETTINGS, json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
		$this->config->setAppValue('nextinject', self::CONFIG_SCHEMA, '2');
		$this->config->setAppValue('nextinject', self::CONFIG_LAST_MODIFIED, gmdate(DATE_ATOM));
	}

	private function sanitizeHeaderAction(array $headerAction): ?array {
		if (!($headerAction['enabled'] ?? false)) {
			return null;
		}

		$label = $this->sanitizeText((string)($headerAction['label'] ?? ''), 90);
		$url = trim((string)($headerAction['url'] ?? ''));
		$variant = in_array(($headerAction['variant'] ?? 'secondary'), ['primary', 'secondary', 'warning'], true)
			? (string)$headerAction['variant']
			: 'secondary';

		if ($label === '' || !$this->isAllowedActionUrl($url)) {
			return null;
		}

		return [
			'enabled' => true,
			'label' => $label,
			'url' => $url,
			'variant' => $variant,
		];
	}

	private function convertLegacyConfigs(array $configs): array {
		$rules = [];

		foreach ($configs as $index => $config) {
			if (!is_array($config)) {
				continue;
			}

			$preset = $this->inferPreset($config);
			$rules[] = [
				'id' => $this->sanitizeIdentifier(sprintf('legacy-%s-%d', $preset, $index)),
				'enabled' => (bool)($config['enabled'] ?? true),
				'label' => $this->sanitizeText((string)($config['label'] ?? $this->getBadgePresets()[$preset]['label']), 100),
				'matcher' => [
					'type' => 'substring',
					'value' => $this->sanitizeText((string)($config['text'] ?? ''), 120),
					'caseSensitive' => true,
				],
				'surfaces' => ['files', 'public'],
				'badgePreset' => $preset,
				'headerAction' => $this->defaultHeaderActionForPreset($preset),
				'description' => $this->sanitizeText((string)($config['description'] ?? $this->getBadgePresets()[$preset]['description'] ?? ''), 180),
				'priority' => (int)($this->getBadgePresets()[$preset]['defaultPriority'] ?? 100) - $index,
			];
		}

		return $this->sanitizeRules($rules);
	}

	private function discoverLegacyUserRules(?string $currentUserId): array {
		$userIds = [];
		foreach ($this->userManager->search('') as $user) {
			$userIds[$user->getUID()] = true;
		}
		if ($currentUserId) {
			$userIds[$currentUserId] = true;
		}

		$legacySources = [];
		$legacyConfigs = [];

		foreach (array_keys($userIds) as $userId) {
			foreach (['nextinject', 'elementinjector'] as $appId) {
				$configs = $this->decodeJson($this->config->getUserValue($userId, $appId, 'targets', ''));
				if ($configs === []) {
					continue;
				}

				$legacyConfigs = [...$legacyConfigs, ...$configs];
				$legacySources[] = sprintf('%s.user.targets:%s', $appId, $userId);
			}
		}

		return [
			$legacyConfigs !== [] ? $this->convertLegacyConfigs($legacyConfigs) : [],
			implode(', ', $legacySources),
		];
	}

	private function inferPreset(array $config): string {
		$haystack = strtoupper(trim((string)($config['text'] ?? $config['label'] ?? $config['className'] ?? '')));

		return match (true) {
			str_contains($haystack, '_AN') => 'angebot',
			str_contains($haystack, '_RE') => 'rechnung',
			str_contains($haystack, '_LI') => 'lieferung',
			str_contains($haystack, '_BE') => 'bestellung',
			str_contains($haystack, '_PROT') => 'protokoll',
			default => 'hinweis',
		};
	}

	private function defaultRules(): array {
		return $this->sanitizeRules([
			[
				'id' => 'angebot-an',
				'label' => 'Angebot',
				'matcher' => ['type' => 'substring', 'value' => '_AN', 'caseSensitive' => true],
				'surfaces' => ['files', 'public'],
				'badgePreset' => 'angebot',
				'headerAction' => $this->defaultHeaderActionForPreset('angebot'),
				'description' => 'Angebots-Dokumente und Freigaben',
				'priority' => 300,
				'enabled' => true,
			],
			[
				'id' => 'rechnung-re',
				'label' => 'Rechnung',
				'matcher' => ['type' => 'substring', 'value' => '_RE', 'caseSensitive' => true],
				'surfaces' => ['files', 'public'],
				'badgePreset' => 'rechnung',
				'headerAction' => $this->defaultHeaderActionForPreset('rechnung'),
				'description' => 'Rechnungs-Dokumente und Zahlungsfreigaben',
				'priority' => 260,
				'enabled' => true,
			],
			[
				'id' => 'lieferung-li',
				'label' => 'Lieferung',
				'matcher' => ['type' => 'substring', 'value' => '_LI', 'caseSensitive' => true],
				'surfaces' => ['files', 'public'],
				'badgePreset' => 'lieferung',
				'headerAction' => null,
				'description' => 'Liefer- und Übergabeunterlagen',
				'priority' => 220,
				'enabled' => true,
			],
		]);
	}

	private function defaultSettings(): array {
		return [
			'injectionDelay' => 180,
			'debugMode' => false,
		];
	}

	private function defaultHeaderActionForPreset(string $preset): ?array {
		return match ($preset) {
			'angebot' => [
				'enabled' => true,
				'label' => 'Angebot bestätigen',
				'url' => 'https://www.telefonansagen.de/kontakt/bestaetigen?kunde={contextLabel}',
				'variant' => 'primary',
			],
			'rechnung' => [
				'enabled' => true,
				'label' => 'Zahlung mitteilen',
				'url' => 'https://www.telefonansagen.de/kontakt/zahlung-mitteilen?kunde={contextLabel}',
				'variant' => 'secondary',
			],
			default => null,
		};
	}

	private function buildStats(array $rules): array {
		return [
			'total' => count($rules),
			'active' => count(array_filter($rules, static fn(array $rule): bool => (bool)$rule['enabled'])),
			'lastModified' => $this->config->getAppValue('nextinject', self::CONFIG_LAST_MODIFIED, 'Never'),
		];
	}

	private function getBadgePresets(): array {
		return [
			'angebot' => [
				'key' => 'angebot',
				'label' => 'Angebot',
				'description' => 'Angebot, Freigabe oder Auftragsbestätigung',
				'className' => 'nextinject-badge--angebot',
				'text' => 'Angebot',
				'icon' => 'AN',
				'defaultPriority' => 300,
			],
			'rechnung' => [
				'key' => 'rechnung',
				'label' => 'Rechnung',
				'description' => 'Rechnung oder Zahlungsbezug',
				'className' => 'nextinject-badge--rechnung',
				'text' => 'Rechnung',
				'icon' => 'RE',
				'defaultPriority' => 260,
			],
			'lieferung' => [
				'key' => 'lieferung',
				'label' => 'Lieferung',
				'description' => 'Lieferung, Übergabe oder Versand',
				'className' => 'nextinject-badge--lieferung',
				'text' => 'Lieferung',
				'icon' => 'LI',
				'defaultPriority' => 220,
			],
			'bestellung' => [
				'key' => 'bestellung',
				'label' => 'Bestellung',
				'description' => 'Bestellung oder Einkaufsprozess',
				'className' => 'nextinject-badge--bestellung',
				'text' => 'Bestellung',
				'icon' => 'BE',
				'defaultPriority' => 180,
			],
			'protokoll' => [
				'key' => 'protokoll',
				'label' => 'Protokoll',
				'description' => 'Protokoll oder Notiz',
				'className' => 'nextinject-badge--protokoll',
				'text' => 'Protokoll',
				'icon' => 'PR',
				'defaultPriority' => 160,
			],
			'hinweis' => [
				'key' => 'hinweis',
				'label' => 'Hinweis',
				'description' => 'Generischer Marker',
				'className' => 'nextinject-badge--hinweis',
				'text' => 'Hinweis',
				'icon' => 'HI',
				'defaultPriority' => 120,
			],
		];
	}

	private function isAllowedActionUrl(string $url): bool {
		if ($url === '') {
			return false;
		}

		$probe = str_replace(['{contextLabel}', '{fileName}'], ['context', 'file'], $url);
		return (bool)filter_var($probe, FILTER_VALIDATE_URL);
	}

	private function decodeJson(string $json): array {
		if ($json === '') {
			return [];
		}

		$decoded = json_decode($json, true);
		return is_array($decoded) ? $decoded : [];
	}

	private function sanitizeIdentifier(string $value): string {
		$value = strtolower(trim($value));
		$value = preg_replace('/[^a-z0-9_-]+/', '-', $value) ?? '';
		return trim($value, '-');
	}

	private function sanitizeText(string $value, int $maxLength = 140): string {
		$value = trim(strip_tags($value));
		if ($value === '') {
			return '';
		}

		return mb_substr($value, 0, $maxLength);
	}
}
