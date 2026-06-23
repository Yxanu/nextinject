<template>
	<div class="nextinject-admin-page">
		<NcSettingsSection
			name="NextInject"
			description="Systemweite Dateimarker und Public-Share-Aktionen. Änderungen werden erst mit Speichern aktiv.">
			<div class="nextinject-toolbar">
				<NcButton
					variant="primary"
					:disabled="saving || !isDirty || validationErrors.length > 0"
					@click="saveState">
					<template #icon>
						<NcIconSvgWrapper :path="mdiContentSave" />
					</template>
					{{ saving ? 'Speichert ...' : 'Speichern' }}
				</NcButton>
				<NcButton @click="addRule">
					<template #icon>
						<NcIconSvgWrapper :path="mdiPlus" />
					</template>
					Regel hinzufügen
				</NcButton>
				<NcButton :disabled="busy" @click="resetDefaults">
					<template #icon>
						<NcIconSvgWrapper :path="mdiRestore" />
					</template>
					Defaults laden
				</NcButton>
				<NcButton :disabled="busy" @click="exportConfiguration">
					<template #icon>
						<NcIconSvgWrapper :path="mdiDownload" />
					</template>
					Export
				</NcButton>
				<NcButton :disabled="busy" @click="triggerImport">
					<template #icon>
						<NcIconSvgWrapper :path="mdiUpload" />
					</template>
					Import
				</NcButton>
				<input
					ref="importInput"
					class="hidden-visually"
					type="file"
					accept="application/json"
					@change="importConfiguration">
			</div>

			<NcNoteCard
				v-if="message"
				class="nextinject-note"
				:type="message.type"
				:show-alert="message.type === 'error'">
				{{ message.text }}
			</NcNoteCard>

			<NcNoteCard
				v-if="validationErrors.length > 0"
				class="nextinject-note"
				type="warning"
				show-alert>
				<div class="nextinject-validation">
					<strong>Speichern ist erst nach Korrektur möglich.</strong>
					<ul>
						<li
							v-for="error in validationErrors"
							:key="error">
							{{ error }}
						</li>
					</ul>
				</div>
			</NcNoteCard>

			<div class="nextinject-status-grid" aria-label="NextInject Status">
				<div class="nextinject-status-item">
					<span>Total</span>
					<strong>{{ liveStats.total }}</strong>
				</div>
				<div class="nextinject-status-item">
					<span>Aktiv</span>
					<strong>{{ liveStats.active }}</strong>
				</div>
				<div class="nextinject-status-item">
					<span>Zuletzt geändert</span>
					<strong>{{ formattedLastModified }}</strong>
				</div>
				<div class="nextinject-status-item">
					<span>Migration</span>
					<strong>{{ migrationLabel }}</strong>
				</div>
			</div>
		</NcSettingsSection>

		<NcSettingsSection
			name="Preset-Galerie"
			description="Vordefinierte Marker als Ausgangspunkt für neue Regeln.">
			<div class="nextinject-preset-list">
				<button
					v-for="preset in presetList"
					:key="preset.key"
					class="nextinject-preset"
					type="button"
					@click="addPresetRule(preset.key)">
					<span :class="['nextinject-badge', preset.className]">
						<span class="nextinject-badge__icon">{{ preset.icon }}</span>
						<span>{{ preset.label }}</span>
					</span>
					<span>{{ preset.description }}</span>
				</button>
			</div>
		</NcSettingsSection>

		<NcSettingsSection
			name="Regeln"
			description="Regeln werden nach Priorität ausgewertet. Höhere Priorität gewinnt.">
			<NcEmptyContent
				v-if="state.rules.length === 0"
				name="Keine Regeln"
				description="Lege eine Regel an oder lade die Standardregeln." />

			<div v-else class="nextinject-rule-list">
				<article
					v-for="(rule, index) in state.rules"
					:key="rule.id"
					class="nextinject-rule-card">
					<header class="nextinject-rule-card__header">
						<div class="nextinject-rule-card__title">
							<span :class="['nextinject-badge', getPreset(rule.badgePreset).className]">
								<span class="nextinject-badge__icon">{{ getPreset(rule.badgePreset).icon }}</span>
								<span>{{ rule.label || getPreset(rule.badgePreset).label }}</span>
							</span>
							<p>{{ rule.description || getPreset(rule.badgePreset).description }}</p>
						</div>
						<div class="nextinject-rule-card__actions">
							<NcCheckboxRadioSwitch
								v-model="rule.enabled"
								type="switch">
								Aktiv
							</NcCheckboxRadioSwitch>
							<NcButton
								variant="error"
								@click="removeRule(index)">
								<template #icon>
									<NcIconSvgWrapper :path="mdiTrashCanOutline" />
								</template>
								Löschen
							</NcButton>
						</div>
					</header>

					<div class="nextinject-form-grid">
						<NcInputField
							v-model="rule.label"
							label="Label"
							label-outside />
						<NcInputField
							v-model="rule.matcher.value"
							label="Matcher"
							label-outside
							placeholder="_AN" />
						<NcSelect
							:model-value="getPreset(rule.badgePreset)"
							:options="presetList"
							input-label="Badge-Preset"
							label="label"
							:clearable="false"
							:searchable="false"
							@update:model-value="setPreset(rule, $event)" />
						<NcInputField
							v-model="rule.priority"
							label="Priorität"
							label-outside
							type="number"
							min="0"
							max="999" />
						<NcInputField
							v-model="rule.description"
							class="nextinject-form-grid__wide"
							label="Beschreibung"
							label-outside />
					</div>

					<div class="nextinject-inline-options">
						<NcCheckboxRadioSwitch v-model="rule.matcher.caseSensitive">
							Case-sensitive Match
						</NcCheckboxRadioSwitch>
						<NcCheckboxRadioSwitch
							:model-value="rule.surfaces.includes('files')"
							@update:model-value="toggleSurface(rule, 'files', $event)">
							Files
						</NcCheckboxRadioSwitch>
						<NcCheckboxRadioSwitch
							:model-value="rule.surfaces.includes('public')"
							@update:model-value="toggleSurface(rule, 'public', $event)">
							Public
						</NcCheckboxRadioSwitch>
					</div>

					<div class="nextinject-header-action">
						<NcCheckboxRadioSwitch
							:model-value="Boolean(rule.headerAction)"
							type="switch"
							@update:model-value="toggleHeaderAction(rule, $event)">
							Header-Aktion im Public Share
						</NcCheckboxRadioSwitch>

						<div
							v-if="rule.headerAction"
							class="nextinject-form-grid nextinject-header-action__fields">
							<NcInputField
								v-model="rule.headerAction.label"
								label="Button-Label"
								label-outside />
							<NcInputField
								v-model="rule.headerAction.url"
								label="URL"
								label-outside
								type="url"
								placeholder="https://example.com/confirm?file={fileName}" />
							<NcSelect
								:model-value="getVariant(rule.headerAction.variant)"
								:options="variantOptions"
								input-label="Variante"
								label="label"
								:clearable="false"
								:searchable="false"
								@update:model-value="setVariant(rule, $event)" />
						</div>
					</div>
				</article>
			</div>
		</NcSettingsSection>

		<NcSettingsSection
			name="Laufzeit"
			description="Diese Werte steuern die Runtime-Injection in Files und Public Shares.">
			<div class="nextinject-form-grid nextinject-form-grid--runtime">
				<NcInputField
					v-model="state.settings.injectionDelay"
					label="Injection Delay (ms)"
					label-outside
					type="number"
					min="0"
					max="5000" />
				<NcCheckboxRadioSwitch
					v-model="state.settings.debugMode"
					type="switch">
					Debug-Ausgabe aktivieren
				</NcCheckboxRadioSwitch>
			</div>
		</NcSettingsSection>

		<NcDialog
			v-model:open="confirmDialog.open"
			:name="confirmDialog.name"
			:message="confirmDialog.text"
			:buttons="confirmButtons"
			@closing="handleConfirmClosing" />
	</div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import {
	mdiContentSave,
	mdiDownload,
	mdiPlus,
	mdiRestore,
	mdiTrashCanOutline,
	mdiUpload,
} from '@mdi/js'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcInputField from '@nextcloud/vue/components/NcInputField'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcSettingsSection from '@nextcloud/vue/components/NcSettingsSection'

const props = defineProps({
	initialPayload: {
		type: Object,
		default: () => ({}),
	},
})

const matcherDefaults = {
	angebot: '_AN',
	rechnung: '_RE',
	lieferung: '_LI',
	bestellung: '_BE',
	protokoll: '_PROT',
	hinweis: '_TAG',
}

const variantOptions = [
	{ key: 'primary', label: 'Primary' },
	{ key: 'secondary', label: 'Secondary' },
	{ key: 'warning', label: 'Warning' },
]

const api = {
	adminConfig: generateUrl('/apps/nextinject/api/v1/admin/config'),
	adminReset: generateUrl('/apps/nextinject/api/v1/admin/config/reset'),
	adminImport: generateUrl('/apps/nextinject/api/v1/admin/config/import'),
	adminExport: generateUrl('/apps/nextinject/api/v1/admin/config/export'),
}

const importInput = ref(null)
const saving = ref(false)
const busy = ref(false)
const message = ref(null)
const confirmDialog = reactive({
	open: false,
	name: '',
	text: '',
	confirmLabel: 'Bestätigen',
	rejectLabel: 'Abbrechen',
	variant: 'warning',
	answer: false,
	resolve: null,
})

const clone = (value) => JSON.parse(JSON.stringify(value ?? null))

const initialRules = Array.isArray(props.initialPayload.rules) ? clone(props.initialPayload.rules) : []
const initialSettings = props.initialPayload.settings || { injectionDelay: 180, debugMode: false }

const state = reactive({
	rules: initialRules,
	settings: {
		injectionDelay: Number(initialSettings.injectionDelay ?? 180),
		debugMode: Boolean(initialSettings.debugMode ?? false),
	},
	presets: props.initialPayload.presets || {},
	stats: props.initialPayload.stats || { total: initialRules.length, active: 0, lastModified: 'Never' },
	meta: props.initialPayload.meta || {},
})

const persistedSnapshot = ref(snapshotState())

const presetList = computed(() => Object.values(state.presets))

const liveStats = computed(() => ({
	total: state.rules.length,
	active: state.rules.filter((rule) => rule.enabled).length,
	lastModified: state.stats.lastModified || 'Never',
}))

const formattedLastModified = computed(() => {
	if (!liveStats.value.lastModified || liveStats.value.lastModified === 'Never') {
		return 'Nie'
	}

	const date = new Date(liveStats.value.lastModified)
	if (Number.isNaN(date.getTime())) {
		return liveStats.value.lastModified
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date)
})

const migrationLabel = computed(() => state.meta.migratedFrom || 'Keine')

const validationErrors = computed(() => {
	const errors = []
	state.rules.forEach((rule, index) => {
		const label = rule.label || `Regel ${index + 1}`
		if (!String(rule.matcher?.value || '').trim()) {
			errors.push(`${label}: Matcher fehlt.`)
		}
		if (!Array.isArray(rule.surfaces) || rule.surfaces.length === 0) {
			errors.push(`${label}: mindestens eine Oberfläche wählen.`)
		}
		if (rule.headerAction) {
			if (!String(rule.headerAction.label || '').trim()) {
				errors.push(`${label}: Button-Label fehlt.`)
			}
			if (!isAllowedActionUrl(rule.headerAction.url)) {
				errors.push(`${label}: Header-Action-URL ist ungültig.`)
			}
		}
	})
	return errors
})

const isDirty = computed(() => snapshotState() !== persistedSnapshot.value)

const confirmButtons = computed(() => [
	{
		label: confirmDialog.rejectLabel,
		callback: () => {
			confirmDialog.answer = false
			return true
		},
	},
	{
		label: confirmDialog.confirmLabel,
		variant: confirmDialog.variant,
		callback: () => {
			confirmDialog.answer = true
			return true
		},
	},
])

function snapshotState() {
	return JSON.stringify({
		rules: state?.rules ?? initialRules,
		settings: state?.settings ?? initialSettings,
	})
}

function getPreset(key) {
	return state.presets[key] || state.presets.hinweis || {
		key: 'hinweis',
		label: 'Hinweis',
		description: 'Generischer Marker',
		className: 'nextinject-badge--hinweis',
		text: 'Hinweis',
		icon: 'HI',
		defaultPriority: 120,
	}
}

function setPreset(rule, preset) {
	const nextPreset = preset?.key ? getPreset(preset.key) : getPreset('hinweis')
	rule.badgePreset = nextPreset.key
	if (!rule.label) {
		rule.label = nextPreset.label
	}
	if (!rule.description) {
		rule.description = nextPreset.description
	}
}

function getVariant(key) {
	return variantOptions.find((variant) => variant.key === key) || variantOptions[1]
}

function setVariant(rule, variant) {
	if (!rule.headerAction) {
		return
	}
	rule.headerAction.variant = variant?.key || 'secondary'
}

function createRuleFromPreset(presetKey) {
	const preset = getPreset(presetKey)
	return {
		id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		enabled: true,
		label: preset.label,
		matcher: {
			type: 'substring',
			value: matcherDefaults[presetKey] || '_TAG',
			caseSensitive: true,
		},
		surfaces: ['files', 'public'],
		badgePreset: preset.key,
		headerAction: null,
		description: preset.description || '',
		priority: preset.defaultPriority || 100,
	}
}

function addRule() {
	state.rules.unshift({
		id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		enabled: true,
		label: 'Neue Regel',
		matcher: { type: 'substring', value: '', caseSensitive: true },
		surfaces: ['files'],
		badgePreset: 'hinweis',
		headerAction: null,
		description: '',
		priority: 100,
	})
}

function addPresetRule(presetKey) {
	state.rules.unshift(createRuleFromPreset(presetKey))
}

async function removeRule(index) {
	const rule = state.rules[index]
	const confirmed = await askConfirmation({
		name: 'Regel löschen',
		text: `Die Regel "${rule?.label || 'ohne Label'}" wird aus der aktuellen Konfiguration entfernt.`,
		confirmLabel: 'Löschen',
		variant: 'error',
	})
	if (!confirmed) {
		return
	}
	state.rules.splice(index, 1)
	setMessage('Regel entfernt. Speichern übernimmt die Änderung.', 'info')
}

function toggleSurface(rule, surface, enabled) {
	const surfaces = new Set(rule.surfaces || [])
	if (enabled) {
		surfaces.add(surface)
	} else {
		surfaces.delete(surface)
	}
	rule.surfaces = Array.from(surfaces)
}

function toggleHeaderAction(rule, enabled) {
	rule.headerAction = enabled
		? (rule.headerAction || { enabled: true, label: '', url: '', variant: 'secondary' })
		: null
}

async function saveState() {
	if (validationErrors.value.length > 0) {
		setMessage('Bitte korrigiere die markierten Regeln vor dem Speichern.', 'warning')
		return
	}

	saving.value = true
	try {
		const response = await axios.post(api.adminConfig, {
			rules: state.rules,
			settings: state.settings,
		})
		applyState(response.data.state)
		persistedSnapshot.value = snapshotState()
		setMessage('Konfiguration gespeichert.', 'success')
	} catch (error) {
		handleError(error, 'Speichern fehlgeschlagen.')
	} finally {
		saving.value = false
	}
}

async function resetDefaults() {
	const confirmed = await askConfirmation({
		name: 'Defaults laden',
		text: 'Die gespeicherte NextInject-Konfiguration wird durch die Standardregeln ersetzt.',
		confirmLabel: 'Defaults laden',
		variant: 'warning',
	})
	if (!confirmed) {
		return
	}

	await runServerAction(async () => {
		const response = await axios.post(api.adminReset)
		applyState(response.data.state)
		persistedSnapshot.value = snapshotState()
		setMessage('Defaults geladen.', 'success')
	}, 'Defaults konnten nicht geladen werden.')
}

function triggerImport() {
	importInput.value?.click()
}

async function importConfiguration(event) {
	const file = event.target.files?.[0]
	event.target.value = ''
	if (!file) {
		return
	}

	let parsed
	try {
		parsed = JSON.parse(await file.text())
	} catch (error) {
		handleError(error, 'Import-Datei ist kein gültiges JSON.')
		return
	}

	await runServerAction(async () => {
		const response = await axios.post(api.adminImport, parsed)
		applyState(response.data.state)
		persistedSnapshot.value = snapshotState()
		setMessage('Import erfolgreich übernommen.', 'success')
	}, 'Import fehlgeschlagen.')
}

async function exportConfiguration() {
	await runServerAction(async () => {
		const response = await axios.get(api.adminExport)
		const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
		const link = document.createElement('a')
		link.href = URL.createObjectURL(blob)
		link.download = 'nextinject-config.json'
		link.click()
		URL.revokeObjectURL(link.href)
	}, 'Export fehlgeschlagen.')
}

async function runServerAction(action, fallbackMessage) {
	busy.value = true
	try {
		await action()
	} catch (error) {
		handleError(error, fallbackMessage)
	} finally {
		busy.value = false
	}
}

function applyState(nextState) {
	if (!nextState) {
		throw new Error('Serverantwort enthält keinen Konfigurationsstand.')
	}
	state.rules = Array.isArray(nextState.rules) ? clone(nextState.rules) : []
	state.settings = nextState.settings || { injectionDelay: 180, debugMode: false }
	state.presets = nextState.presets || state.presets
	state.stats = nextState.stats || state.stats
	state.meta = nextState.meta || state.meta
}

function setMessage(text, type = 'success') {
	message.value = { text, type }
}

function handleError(error, fallbackMessage) {
	const text = error?.response?.data?.error || error?.message || fallbackMessage
	setMessage(text, 'error')
}

function askConfirmation({ name, text, confirmLabel, rejectLabel = 'Abbrechen', variant = 'warning' }) {
	return new Promise((resolve) => {
		Object.assign(confirmDialog, {
			open: true,
			name,
			text,
			confirmLabel,
			rejectLabel,
			variant,
			answer: false,
			resolve,
		})
	})
}

function handleConfirmClosing() {
	if (!confirmDialog.resolve) {
		return
	}

	const resolve = confirmDialog.resolve
	const answer = confirmDialog.answer === true
	confirmDialog.resolve = null
	confirmDialog.answer = false
	resolve(answer)
}

function isAllowedActionUrl(url) {
	if (!String(url || '').trim()) {
		return false
	}

	try {
		const probe = String(url).replaceAll('{contextLabel}', 'context').replaceAll('{fileName}', 'file')
		const parsed = new URL(probe)
		return ['http:', 'https:'].includes(parsed.protocol)
	} catch (error) {
		return false
	}
}
</script>
