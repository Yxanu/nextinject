<?php
return [
	'routes' => [
		// Admin API Routes
		['name' => 'admin#getConfig', 'url' => '/api/v1/admin/config', 'verb' => 'GET'],
		['name' => 'admin#saveConfig', 'url' => '/api/v1/admin/config', 'verb' => 'POST'],
		['name' => 'admin#deleteConfig', 'url' => '/api/v1/admin/config/{id}', 'verb' => 'DELETE'],
		['name' => 'admin#resetConfig', 'url' => '/api/v1/admin/config/reset', 'verb' => 'POST'],
		
		// Public API Routes (für Frontend-Zugriff)
		['name' => 'admin#getPublicConfig', 'url' => '/api/v1/config', 'verb' => 'GET'],
		
		// Page Routes
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'page#admin', 'url' => '/admin', 'verb' => 'GET'],
	]
];