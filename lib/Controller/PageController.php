<?php
declare(strict_types=1);

namespace OCA\ElementInjector\Controller;

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
		Util::addScript('elementinjector', 'admin');
		return new TemplateResponse('elementinjector', 'settings-personal');
	}

	/**
	 * @NoAdminRequired 
	 * @NoCSRFRequired
	 */
	public function settings(): TemplateResponse {
		Util::addScript('elementinjector', 'admin');
		return new TemplateResponse('elementinjector', 'settings-personal');
	}
}