<?php
declare(strict_types=1);

namespace OCA\NextInject\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Util;

class Application extends App implements IBootstrap {
	public const APP_ID = 'nextinject';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		// Register services, hooks, etc.
	}

	public function boot(IBootContext $context): void {
		$context->injectFn(function() {
			// Inject JavaScript in Files app for all users
			if ($this->isFilesApp()) {
				Util::addScript(self::APP_ID, 'injector');
				Util::addStyle(self::APP_ID, 'style');
			}
		});
	}

	private function isFilesApp(): bool {
		return strpos($_SERVER['REQUEST_URI'] ?? '', '/apps/files') !== false;
	}
}