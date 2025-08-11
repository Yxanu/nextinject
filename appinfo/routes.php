<?php
return [
	'routes' => [
		// API Routes
		['name' => 'config#getConfig', 'url' => '/api/v1/config', 'verb' => 'GET'],
		['name' => 'config#saveConfig', 'url' => '/api/v1/config', 'verb' => 'POST'],
		['name' => 'config#deleteConfig', 'url' => '/api/v1/config/{id}', 'verb' => 'DELETE'],
		
		// Page Routes
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'page#settings', 'url' => '/settings', 'verb' => 'GET'],
	]
];