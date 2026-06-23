<?php
declare(strict_types=1);

namespace OCA\NextInject\Sections;

use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\Settings\IIconSection;

class Admin implements IIconSection {
	public function __construct(
		private readonly IL10N $l,
		private readonly IURLGenerator $urlGenerator,
	) {
	}

	public function getID(): string {
		return 'nextinject';
	}

	public function getName(): string {
		return $this->l->t('NextInject');
	}

	public function getPriority(): int {
		return 65;
	}

	public function getIcon(): string {
		return $this->urlGenerator->imagePath('nextinject', 'app.svg');
	}
}
