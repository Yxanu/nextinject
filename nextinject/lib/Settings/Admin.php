<?php
declare(strict_types=1);

namespace OCA\NextInject\Settings;

use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\Settings\ISettings;
use OCP\Util;

class Admin implements ISettings {
	
	private $config;

	public function __construct(IConfig $config) {
		$this->config = $config;
	}

	public function getForm(): TemplateResponse {
		Util::addScript('nextinject', 'admin');
		Util::addStyle('nextinject', 'style');
		
		// Statistiken für Admin-Dashboard
		$configJson = $this->config->getAppValue('nextinject', 'admin_targets', '[]');
		$configs = json_decode($configJson, true) ?: [];
		
		$stats = [
			'total_configs' => count($configs),
			'enabled_configs' => count(array_filter($configs, fn($c) => $c['enabled'] ?? true)),
			'last_modified' => $this->config->getAppValue('nextinject', 'last_modified', 'Never')
		];
		
		return new TemplateResponse('nextinject', 'settings-admin', $stats, '');
	}

	public function getSection(): string {
		return 'additional';
	}

	public function getPriority(): int {
		return 50;
	}
}