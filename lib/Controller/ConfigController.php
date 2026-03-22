<?php
declare(strict_types=1);

namespace OCA\NextInject\Controller;

use OCA\NextInject\Service\RuleService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Attribute\AdminRequired;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\IRequest;
use OCP\IUserSession;

class ConfigController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly RuleService $ruleService,
		private readonly IUserSession $userSession,
	) {
		parent::__construct($appName, $request);
	}

	#[AdminRequired]
	public function getAdminConfig(): JSONResponse {
		return new JSONResponse($this->ruleService->getAdminPayload($this->getCurrentUserId()));
	}

	#[AdminRequired]
	public function saveAdminConfig(): JSONResponse {
		return new JSONResponse([
			'success' => true,
			'state' => $this->ruleService->saveAdminState($this->readJsonBody(), $this->getCurrentUserId()),
		]);
	}

	#[AdminRequired]
	public function deleteAdminRule(string $id): JSONResponse {
		return new JSONResponse([
			'success' => true,
			'state' => $this->ruleService->deleteRule($id, $this->getCurrentUserId()),
		]);
	}

	#[AdminRequired]
	public function resetAdminConfig(): JSONResponse {
		return new JSONResponse([
			'success' => true,
			'state' => $this->ruleService->resetToDefaults($this->getCurrentUserId()),
		]);
	}

	#[AdminRequired]
	public function importAdminConfig(): JSONResponse {
		return new JSONResponse([
			'success' => true,
			'state' => $this->ruleService->importState($this->readJsonBody(), $this->getCurrentUserId()),
		]);
	}

	#[AdminRequired]
	public function exportAdminConfig(): JSONResponse {
		return new JSONResponse($this->ruleService->exportState($this->getCurrentUserId()));
	}

	#[PublicPage]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function getFrontendConfig(): JSONResponse {
		return new JSONResponse($this->ruleService->getFrontendPayload($this->getCurrentUserId()), 200);
	}

	private function readJsonBody(): array {
		$content = file_get_contents('php://input');
		if (!is_string($content) || trim($content) === '') {
			return [];
		}

		$decoded = json_decode($content, true);
		return is_array($decoded) ? $decoded : [];
	}

	private function getCurrentUserId(): ?string {
		return $this->userSession->getUser()?->getUID();
	}
}
