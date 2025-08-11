<?php
script('elementinjector', 'admin');
style('elementinjector', 'style');
?>

<div class="section" id="elementinjector">
	<h2><?php p($l->t('NextInject')); ?></h2>
	<p class="settings-hint"><?php p($l->t('Configure element injection patterns for file names')); ?></p>
	
	<div class="elementinjector-settings">
		<div id="elementinjector-loading" class="icon-loading-small" style="display: inline-block;">
			<?php p($l->t('Loading configuration...')); ?>
		</div>
		
		<div id="elementinjector-content" style="display: none;">
			<div class="elementinjector-section">
				<h3><?php p($l->t('Current Configurations')); ?></h3>
				<div id="elementinjector-configurations">
					<!-- Wird dynamisch gefüllt -->
				</div>
				
				<button class="button primary" id="elementinjector-add-new">
					<span class="icon-add"></span>
					<?php p($l->t('Add New Configuration')); ?>
				</button>
			</div>

			<div class="elementinjector-section">
				<h3><?php p($l->t('Preview')); ?></h3>
				<div id="elementinjector-preview">
					<!-- Vorschau wird hier angezeigt -->
				</div>
			</div>

			<div class="elementinjector-section">
				<h3><?php p($l->t('Template Library')); ?></h3>
				<div class="elementinjector-templates">
					<button class="template-btn" data-template="angebot">📄 <?php p($l->t('Quote')); ?></button>
					<button class="template-btn" data-template="rechnung">💰 <?php p($l->t('Invoice')); ?></button>
					<button class="template-btn" data-template="lieferung">🚚 <?php p($l->t('Delivery')); ?></button>
					<button class="template-btn" data-template="mahnung">⚠️ <?php p($l->t('Reminder')); ?></button>
					<button class="template-btn" data-template="gutschrift">💸 <?php p($l->t('Credit Note')); ?></button>
					<button class="template-btn" data-template="bestellung">🛒 <?php p($l->t('Order')); ?></button>
				</div>
			</div>

			<div class="elementinjector-actions">
				<button class="button primary" id="elementinjector-save">
					<span class="icon-checkmark"></span>
					<?php p($l->t('Save Configuration')); ?>
				</button>
				
				<button class="button" id="elementinjector-export">
					<span class="icon-download"></span>
					<?php p($l->t('Export')); ?>
				</button>
				
				<button class="button" id="elementinjector-import">
					<span class="icon-upload"></span>
					<?php p($l->t('Import')); ?>
				</button>
			</div>
		</div>

		<div id="elementinjector-message" class="msg" style="display: none;"></div>
	</div>
</div>