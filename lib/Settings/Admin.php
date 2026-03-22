<?php
declare(strict_types=1);

namespace OCA\NextInject\Settings;

use OCA\NextInject\Service\RuleService;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IUserSession;
use OCP\Settings\ISettings;
use OCP\Util;

class Admin implements ISettings {
	public function __construct(
		private readonly RuleService $ruleService,
		private readonly IUserSession $userSession,
	) {
	}

	public function getForm(): TemplateResponse {
		Util::addScript('nextinject', 'admin');
		Util::addStyle('nextinject', 'style');

		return new TemplateResponse(
			'nextinject',
			'settings-admin',
			$this->ruleService->getAdminPayload($this->userSession->getUser()?->getUID()),
			''
		);
	}

	public function getSection(): string {
		return 'additional';
	}

	public function getPriority(): int {
		return 50;
	}
}
