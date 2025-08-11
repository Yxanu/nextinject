<?php
// apps/nextinject/templates/admin-settings.php - VOLLSTÄNDIGE VERSION
script('nextinject', 'admin');
style('nextinject', 'admin');
?>

<div class="section" id="nextinject-admin">
	<h2><?php p($l->t('NextInject - Element Injection Configuration')); ?></h2>
	<p class="settings-hint">
		<?php p($l->t('Configure system-wide element injection patterns for file names. These settings apply to all users.')); ?>
	</p>
	
	<!-- Statistics Section -->
	<div class="nextinject-admin-stats">
		<div class="stat-card">
			<h3><?php p($l->t('Statistics')); ?></h3>
			<div class="stats-grid">
				<div class="stat-item">
					<span class="stat-label"><?php p($l->t('Total Configurations:')); ?></span>
					<span class="stat-value" id="total-configs">0</span>
				</div>
				<div class="stat-item">
					<span class="stat-label"><?php p($l->t('Active Configurations:')); ?></span>
					<span class="stat-value" id="active-configs">0</span>
				</div>
				<div class="stat-item">
					<span class="stat-label"><?php p($l->t('Last Modified:')); ?></span>
					<span class="stat-value" id="last-modified">Never</span>
				</div>
			</div>
		</div>
	</div>
	
	<div class="nextinject-settings">
		<div id="nextinject-loading" class="icon-loading-small" style="display: inline-block;">
			<?php p($l->t('Loading configuration...')); ?>
		</div>
		
		<div id="nextinject-content" style="display: none;">
			
			<!-- Quick Actions -->
			<div class="nextinject-section quick-actions">
				<h3><?php p($l->t('Quick Actions')); ?></h3>
				<div class="action-buttons">
					<button class="button primary" id="nextinject-add-new">
						<span class="icon-add"></span>
						<?php p($l->t('Add New Configuration')); ?>
					</button>
					
					<button class="button" id="nextinject-reset">
						<span class="icon-history"></span>
						<?php p($l->t('Reset to Defaults')); ?>
					</button>
					
					<button class="button" id="nextinject-export">
						<span class="icon-download"></span>
						<?php p($l->t('Export All')); ?>
					</button>
					
					<button class="button" id="nextinject-import">
						<span class="icon-upload"></span>
						<?php p($l->t('Import')); ?>
					</button>
				</div>
			</div>

			<!-- Configuration List -->
			<div class="nextinject-section">
				<h3><?php p($l->t('Current Configurations')); ?></h3>
				<p class="subsection-hint">
					<?php p($l->t('These patterns will be applied to all users in the Files app.')); ?>
				</p>
				<div id="nextinject-configurations">
					<!-- Wird dynamisch gefüllt -->
				</div>
			</div>

			<!-- Template Library -->
			<div class="nextinject-section">
				<h3><?php p($l->t('Template Library')); ?></h3>
				<p class="subsection-hint">
					<?php p($l->t('Click to add predefined templates to your configuration.')); ?>
				</p>
				<div class="nextinject-templates">
					<button class="template-btn" data-template="angebot">
						📄 <?php p($l->t('Quote')); ?>
					</button>
					<button class="template-btn" data-template="rechnung">
						💰 <?php p($l->t('Invoice')); ?>
					</button>
					<button class="template-btn" data-template="lieferung">
						🚚 <?php p($l->t('Delivery')); ?>
					</button>
					<button class="template-btn" data-template="mahnung">
						⚠️ <?php p($l->t('Reminder')); ?>
					</button>
					<button class="template-btn" data-template="gutschrift">
						💸 <?php p($l->t('Credit Note')); ?>
					</button>
					<button class="template-btn" data-template="bestellung">
						🛒 <?php p($l->t('Order')); ?>
					</button>
				</div>
			</div>

			<!-- Live Preview -->
			<div class="nextinject-section">
				<h3><?php p($l->t('Live Preview')); ?></h3>
				<p class="subsection-hint">
					<?php p($l->t('See how your configurations will appear in the Files app.')); ?>
				</p>
				<div id="nextinject-preview">
					<!-- Vorschau wird hier angezeigt -->
				</div>
			</div>

			<!-- Save Actions -->
			<div class="nextinject-actions">
				<button class="button primary" id="nextinject-save">
					<span class="icon-checkmark"></span>
					<?php p($l->t('Save Configuration')); ?>
				</button>
				
				<button class="button secondary" id="nextinject-test">
					<span class="icon-play"></span>
					<?php p($l->t('Test Configuration')); ?>
				</button>
			</div>
		</div>

		<div id="nextinject-message" class="msg" style="display: none;"></div>
	</div>
</div>