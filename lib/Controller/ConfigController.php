<?php
declare(strict_types=1);

namespace OCA\ElementInjector\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;
use OCP\IConfig;
use OCP\IUserSession;

class ConfigController extends Controller {
	
	private $config;
	private $userSession;

	public function __construct(
		$AppName,
		IRequest $request,
		IConfig $config,
		IUserSession $userSession
	) {
		parent::__construct($AppName, $request);
		$this->config = $config;
		$this->userSession = $userSession;
	}

	/**
	 * @NoAdminRequired
	 * @return JSONResponse
	 */
	public function getConfig(): JSONResponse {
		$user = $this->userSession->getUser();
		if (!$user) {
			return new JSONResponse(['error' => 'User not found'], 401);
		}

		$configJson = $this->config->getUserValue(
			$user->getUID(),
			'elementinjector',
			'targets',
			'[]'
		);
		
		$configs = json_decode($configJson, true) ?: [];
		
		return new JSONResponse(['configs' => $configs]);
	}

	/**
	 * @NoAdminRequired
	 * @return JSONResponse
	 */
	public function saveConfig(): JSONResponse {
		$user = $this->userSession->getUser();
		if (!$user) {
			return new JSONResponse(['error' => 'User not found'], 401);
		}

		$configs = $this->request->getParam('configs', []);
		if (!is_array($configs)) {
			return new JSONResponse(['error' => 'Invalid config format'], 400);
		}
		
		// Validierung
		foreach ($configs as $index => $config) {
			if (!isset($config['text']) || !isset($config['template']) || !isset($config['className'])) {
				return new JSONResponse(['error' => 'Invalid config format'], 400);
			}

			if (!is_string($config['text']) || !is_string($config['template']) || !is_string($config['className'])) {
				return new JSONResponse(['error' => 'Invalid config format'], 400);
			}

			// Normalize optional fields
			if (!isset($config['enabled'])) {
				$config['enabled'] = true;
			} else {
				$config['enabled'] = (bool)$config['enabled'];
			}

			$configs[$index] = $config;
		}
		
		$configJson = json_encode($configs);
		
		$this->config->setUserValue(
			$user->getUID(),
			'elementinjector',
			'targets',
			$configJson
		);
		
		return new JSONResponse(['success' => true, 'message' => 'Configuration saved successfully']);
	}

	/**
	 * @NoAdminRequired
	 * @param int $id
	 * @return JSONResponse
	 */
	public function deleteConfig(int $id): JSONResponse {
		$user = $this->userSession->getUser();
		if (!$user) {
			return new JSONResponse(['error' => 'User not found'], 401);
		}

		$configJson = $this->config->getUserValue(
			$user->getUID(),
			'elementinjector',
			'targets',
			'[]'
		);
		
		$configs = json_decode($configJson, true) ?: [];
		
		if (isset($configs[$id])) {
			unset($configs[$id]);
			$configs = array_values($configs); // Re-index array
			
			$this->config->setUserValue(
				$user->getUID(),
				'elementinjector',
				'targets',
				json_encode($configs)
			);
			
			return new JSONResponse(['success' => true, 'message' => 'Configuration deleted']);
		}
		
		return new JSONResponse(['error' => 'Configuration not found'], 404);
	}
}
