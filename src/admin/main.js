import { createApp } from 'vue'
import './admin.css'
import AdminApp from './AdminApp.vue'

const root = document.getElementById('nextinject-admin')

if (root) {
	const initialPayload = (() => {
		try {
			return JSON.parse(window.atob(root.dataset.initial || ''))
		} catch (error) {
			console.error('NextInject: failed to parse initial payload', error)
			return {}
		}
	})()

	createApp(AdminApp, { initialPayload }).mount(root)
}
