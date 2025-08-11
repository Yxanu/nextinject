<?php
declare(strict_types=1);

namespace OCA\ElementInjector\Settings;

use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\Settings\ISettings;
use OCP\Util;

class Personal implements ISettings {
	
	private $config;

	public function __construct(IConfig $config) {
		$this->config = $config;
	}

	public function getForm(): TemplateResponse {
		Util::addScript('elementinjector', 'admin');
		Util::addStyle('elementinjector', 'style');
		
		return new TemplateResponse('elementinjector', 'settings-personal', [], '');
	}

	public function getSection(): string {
		return 'additional';
	}

	public function getPriority(): int {
		return 50;
	}
}