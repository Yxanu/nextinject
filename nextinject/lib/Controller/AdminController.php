<?php
declare(strict_types=1);

namespace OCA\NextInject\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IConfig;

class AdminController extends Controller {
	
	private $config;

	public function __construct(
		$AppName,
		IRequest $request,
		IConfig $config
	) {
		parent::__construct($AppName, $request);
		$this->config = $config;
	}

	/**
	 * @AdminRequired
	 * @return JSONResponse
	 */
	public function getConfig(): JSONResponse {
		$configJson = $this->config->getAppValue(
			'nextinject',
			'admin_targets',
			'[]'
		);
		
		$configs = json_decode($configJson, true) ?: [];
		
		return new JSONResponse([
			'configs' => $configs,
			'meta' => [
				'total' => count($configs),
				'enabled' => count(array_filter($configs, fn($c) => $c['enabled'] ?? true))
			]
		]);
	}

	/**
	 * @AdminRequired
	 * @return JSONResponse
	 */
	public function saveConfig(): JSONResponse {
		$configs = $this->request->getParam('configs', []);
		
		// Erweiterte Validierung
		foreach ($configs as $index => $config) {
			if (!isset($config['text']) || !isset($config['template']) || !isset($config['className'])) {
				return new JSONResponse(['error' => "Invalid config format at index $index"], 400);
			}
			
			// Sanitization
			$config['text'] = trim($config['text']);
			$config['className'] = trim($config['className']);
			$config['template'] = htmlspecialchars($config['template'], ENT_QUOTES, 'UTF-8');
			
			// Validierung der Text-Muster
			if (empty($config['text']) || strlen($config['text']) > 50) {
				return new JSONResponse(['error' => "Invalid text pattern at index $index"], 400);
			}
			
			// Validierung der CSS-Klassen
			if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_-]*$/', $config['className'])) {
				return new JSONResponse(['error' => "Invalid CSS class name at index $index"], 400);
			}
			
			$configs[$index] = $config;
		}
		
		$configJson = json_encode($configs);
		
		$this->config->setAppValue(
			'nextinject',
			'admin_targets',
			$configJson
		);
		
		// Log der Änderung
		\OCP\Util::writeLog('nextinject', 
			'Admin configuration updated by user: ' . \OC_User::getUser() . 
			', configs: ' . count($configs), 
			\OCP\Util::INFO
		);
		
		return new JSONResponse([
			'success' => true, 
			'message' => 'Configuration saved successfully',
			'total' => count($configs)
		]);
	}

	/**
	 * @AdminRequired
	 * @param int $id
	 * @return JSONResponse
	 */
	public function deleteConfig(int $id): JSONResponse {
		$configJson = $this->config->getAppValue(
			'nextinject',
			'admin_targets',
			'[]'
		);
		
		$configs = json_decode($configJson, true) ?: [];
		
		if (isset($configs[$id])) {
			$deletedConfig = $configs[$id];
			unset($configs[$id]);
			$configs = array_values($configs); // Re-index array
			
			$this->config->setAppValue(
				'nextinject',
				'admin_targets',
				json_encode($configs)
			);
			
			\OCP\Util::writeLog('nextinject', 
				'Admin deleted config: ' . json_encode($deletedConfig), 
				\OCP\Util::INFO
			);
			
			return new JSONResponse([
				'success' => true, 
				'message' => 'Configuration deleted',
				'remaining' => count($configs)
			]);
		}
		
		return new JSONResponse(['error' => 'Configuration not found'], 404);
	}

	/**
	 * @AdminRequired
	 * @return JSONResponse
	 */
	public function resetConfig(): JSONResponse {
		$defaultConfigs = [
			[
				'text' => '_AN',
				'template' => '<span class="badge badge-info"><i class="fas fa-file-invoice"></i> Angebot</span>',
				'className' => 'kat-angebot',
				'enabled' => true,
				'description' => 'Angebots-Dokumente'
			],
			[
				'text' => '_RE',
				'template' => '<span class="badge badge-success"><i class="fas fa-receipt"></i> Rechnung</span>',
				'className' => 'kat-rechnung',
				'enabled' => true,
				'description' => 'Rechnungs-Dokumente'
			],
			[
				'text' => '_LI',
				'template' => '<span class="badge badge-warning"><i class="fas fa-truck"></i> Lieferung</span>',
				'className' => 'kat-lieferung',
				'enabled' => true,
				'description' => 'Lieferungs-Dokumente'
			]
		];
		
		$this->config->setAppValue(
			'nextinject',
			'admin_targets',
			json_encode($defaultConfigs)
		);
		
		\OCP\Util::writeLog('nextinject', 
			'Admin reset configuration to defaults', 
			\OCP\Util::INFO
		);
		
		return new JSONResponse([
			'success' => true,
			'message' => 'Configuration reset to defaults',
			'configs' => $defaultConfigs
		]);
	}

	/**
	 * @NoAdminRequired
	 * Public API für Frontend-Zugriff (alle Benutzer können lesen)
	 * @return JSONResponse
	 */
	public function getPublicConfig(): JSONResponse {
		$configJson = $this->config->getAppValue(
			'nextinject',
			'admin_targets',
			'[]'
		);
		
		$configs = json_decode($configJson, true) ?: [];
		
		// Nur aktivierte Konfigurationen zurückgeben
		$enabledConfigs = array_filter($configs, fn($config) => $config['enabled'] ?? true);
		
		return new JSONResponse([
			'configs' => array_values($enabledConfigs)
		]);
	}
}