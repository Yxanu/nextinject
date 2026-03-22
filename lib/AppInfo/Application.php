<?php
declare(strict_types=1);

namespace OCA\NextInject\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\IRequest;
use OCP\Util;

class Application extends App implements IBootstrap {
	public const APP_ID = 'nextinject';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
	}

	public function boot(IBootContext $context): void {
		$context->injectFn(function (IRequest $request): void {
			if (!$this->shouldInjectRuntime($request)) {
				return;
			}

			Util::addScript(self::APP_ID, 'injector');
			Util::addStyle(self::APP_ID, 'style');
		});
	}

	private function shouldInjectRuntime(IRequest $request): bool {
		$path = (string)($request->getPathInfo() ?? '');

		if ($path === '') {
			return false;
		}

		return str_contains($path, '/apps/files')
			|| (bool)preg_match('#/(index\.php/)?s/#', $path);
	}
}
