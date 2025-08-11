<?php
declare(strict_types=1);

namespace OCA\NextInject\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\Util;

class PageController extends Controller {

	public function __construct($AppName, IRequest $request) {
		parent::__construct($AppName, $request);
	}

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	public function index(): TemplateResponse {
		return new TemplateResponse('nextinject', 'index');
	}

	/**
	 * @AdminRequired
	 * @NoCSRFRequired
	 */
	public function admin(): TemplateResponse {
		Util::addScript('nextinject', 'admin');
		Util::addStyle('nextinject', 'style');
		return new TemplateResponse('nextinject', 'settings-admin');
	}
}