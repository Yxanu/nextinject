<?php
declare(strict_types=1);

namespace OCA\ElementInjector\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Util;

class Application extends App implements IBootstrap {
	public const APP_ID = 'elementinjector';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		// Register the ConfigController
		$context->registerServiceAlias('ConfigController', \OCA\ElementInjector\Controller\ConfigController::class);
	}

	public function boot(IBootContext $context): void {
		$context->injectFn(function() {
			// Only inject in Files app context
			$path = \OC::$server->getRequest()->getPathInfo() ?? '';
			if (str_starts_with($path, '/apps/files') ||
			    str_starts_with($path, '/s/')) {
				Util::addScript(self::APP_ID, 'injector');
				Util::addStyle(self::APP_ID, 'style');
			}
		});
	}
}
