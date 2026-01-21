import type { Client } from '../client'

export interface RemoveKvRecordsRequestParams {
	type?: number
	ids?: string[]
}

export interface RemoveKvRecordsRequestFunctionParams
	extends RemoveKvRecordsRequestParams {
	client: Client
}
