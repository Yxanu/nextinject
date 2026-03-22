<?php
script('nextinject', 'admin');
style('nextinject', 'style');

$initialPayload = base64_encode((string)json_encode($_, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
?>

<div id="nextinject-admin"
	class="nextinject-admin"
	data-initial="<?php p($initialPayload); ?>">
	<noscript>
		<div class="nextinject-admin__noscript">
			<h2><?php p($l->t('NextInject')); ?></h2>
			<p><?php p($l->t('JavaScript is required to manage NextInject rules.')); ?></p>
		</div>
	</noscript>
</div>
