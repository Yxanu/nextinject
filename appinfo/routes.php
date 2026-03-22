<?php

return [
	'routes' => [
		['name' => 'config#getAdminConfig', 'url' => '/api/v1/admin/config', 'verb' => 'GET'],
		['name' => 'config#saveAdminConfig', 'url' => '/api/v1/admin/config', 'verb' => 'POST'],
		['name' => 'config#deleteAdminRule', 'url' => '/api/v1/admin/config/{id}', 'verb' => 'DELETE'],
		['name' => 'config#resetAdminConfig', 'url' => '/api/v1/admin/config/reset', 'verb' => 'POST'],
		['name' => 'config#importAdminConfig', 'url' => '/api/v1/admin/config/import', 'verb' => 'POST'],
		['name' => 'config#exportAdminConfig', 'url' => '/api/v1/admin/config/export', 'verb' => 'GET'],
		['name' => 'config#getFrontendConfig', 'url' => '/api/v1/frontend/config', 'verb' => 'GET'],
	],
];
