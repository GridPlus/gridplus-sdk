import type { Client } from '../client'
import type { KVRecords } from './shared'

export interface AddKvRecordsRequestParams {
	records: KVRecords
	type?: number
	caseSensitive?: boolean
}

export interface AddKvRecordsRequestFunctionParams
	extends AddKvRecordsRequestParams {
	client: Client
}
