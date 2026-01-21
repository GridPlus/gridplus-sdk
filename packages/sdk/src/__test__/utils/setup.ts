import * as fs from 'node:fs'
import readlineSync from 'readline-sync'
import { getClient, pair, setup } from '../../api'

const question = readlineSync.question

const TEMP_CLIENT_FILE = './client.temp'

export async function setStoredClient(data: string) {
	try {
		fs.writeFileSync(TEMP_CLIENT_FILE, data)
	} catch (err) {
		console.error('Failed to store client data:', err)
		return
	}
}

export async function getStoredClient() {
	try {
		return fs.readFileSync(TEMP_CLIENT_FILE, 'utf8')
	} catch (err) {
		console.error('Failed to read stored client data:', err)
		return ''
	}
}

export async function setupClient() {
	const deviceId = process.env.DEVICE_ID
	const baseUrl = process.env.baseUrl || 'https://signing.gridpl.us'
	const password = process.env.PASSWORD || 'password'
	const name = process.env.APP_NAME || 'SDK Test'
	let pairingSecret = process.env.PAIRING_SECRET
	const isPaired = await setup({
		deviceId,
		password,
		name,
		baseUrl,
		getStoredClient,
		setStoredClient,
	})
	if (!isPaired) {
		if (!pairingSecret) {
			if (process.env.CI) {
				throw new Error('Pairing secret is required. If simulator is running, set PAIRING_SECRET environment variable.')
			}
			pairingSecret = question('Enter pairing secret:')
			if (!pairingSecret) {
				throw new Error('Pairing secret is required.')
			}
		}
		await pair(pairingSecret.toUpperCase())
	}
	return getClient()
}
