import type { TypedTransaction } from "@ethereumjs/tx";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import BIP32Factory from "bip32";
import { mnemonicToSeedSync } from "bip39";
import { ecsign, privateToAddress } from "ethereumjs-util";
import { Hash } from "ox";
import * as ecc from "tiny-secp256k1";
import type { Client } from "../../client";
import { getPathStr } from "../../shared/utilities";
import type { SigningPath, TestRequestPayload } from "../../types";
import { buildTestRequestPayload } from "./builders";
import { ethPersonalSignMsg, getSigStr, jobTypes } from "./helpers";
import { TEST_MNEMONIC } from "./testConstants";

export const TEST_SEED = mnemonicToSeedSync(TEST_MNEMONIC);

export function setupJob(
	type: number,
	client: Client,
	seed?: Buffer,
): TestRequestPayload {
	if (type === jobTypes.WALLET_JOB_EXPORT_SEED) {
		return buildTestRequestPayload(client, type, {});
	} else if (type === jobTypes.WALLET_JOB_DELETE_SEED) {
		return buildTestRequestPayload(client, type, {
			iface: 1,
		});
	} else if (type === jobTypes.WALLET_JOB_LOAD_SEED) {
		return buildTestRequestPayload(client, type, {
			iface: 1, // external SafeCard interface
			seed,
			exportability: 2, // always exportable
		});
	}
	return buildTestRequestPayload(client, type, {});
}

export async function testUniformSigs(
	payload: any,
	tx: TypedTransaction,
	client: Client,
) {
	const tx1Resp = await client.sign(payload);
	const tx2Resp = await client.sign(payload);
	const tx3Resp = await client.sign(payload);
	const tx4Resp = await client.sign(payload);
	const tx5Resp = await client.sign(payload);
	// Check sig 1
	expect(getSigStr(tx1Resp, tx)).toEqual(getSigStr(tx2Resp, tx));
	expect(getSigStr(tx1Resp, tx)).toEqual(getSigStr(tx3Resp, tx));
	expect(getSigStr(tx1Resp, tx)).toEqual(getSigStr(tx4Resp, tx));
	expect(getSigStr(tx1Resp, tx)).toEqual(getSigStr(tx5Resp, tx));
	// Check sig 2
	expect(getSigStr(tx2Resp, tx)).toEqual(getSigStr(tx1Resp, tx));
	expect(getSigStr(tx2Resp, tx)).toEqual(getSigStr(tx3Resp, tx));
	expect(getSigStr(tx2Resp, tx)).toEqual(getSigStr(tx4Resp, tx));
	expect(getSigStr(tx2Resp, tx)).toEqual(getSigStr(tx5Resp, tx));
	// Check sig 3
	expect(getSigStr(tx3Resp, tx)).toEqual(getSigStr(tx1Resp, tx));
	expect(getSigStr(tx3Resp, tx)).toEqual(getSigStr(tx2Resp, tx));
	expect(getSigStr(tx3Resp, tx)).toEqual(getSigStr(tx4Resp, tx));
	expect(getSigStr(tx3Resp, tx)).toEqual(getSigStr(tx5Resp, tx));
	// Check sig 4
	expect(getSigStr(tx4Resp, tx)).toEqual(getSigStr(tx1Resp, tx));
	expect(getSigStr(tx4Resp, tx)).toEqual(getSigStr(tx2Resp, tx));
	expect(getSigStr(tx4Resp, tx)).toEqual(getSigStr(tx3Resp, tx));
	expect(getSigStr(tx4Resp, tx)).toEqual(getSigStr(tx5Resp, tx));
	// Check sig 5
	expect(getSigStr(tx5Resp, tx)).toEqual(getSigStr(tx1Resp, tx));
	expect(getSigStr(tx5Resp, tx)).toEqual(getSigStr(tx2Resp, tx));
	expect(getSigStr(tx5Resp, tx)).toEqual(getSigStr(tx3Resp, tx));
	expect(getSigStr(tx5Resp, tx)).toEqual(getSigStr(tx4Resp, tx));
}

export function deriveAddress(seed: Buffer, path: SigningPath) {
	const bip32 = BIP32Factory(ecc);
	const wallet = bip32.fromSeed(seed);
	const priv = wallet.derivePath(getPathStr(path)).privateKey;
	return `0x${privateToAddress(priv).toString("hex")}`;
}

export function signPersonalJS(_msg: string, path: SigningPath) {
	const bip32 = BIP32Factory(ecc);
	const wallet = bip32.fromSeed(TEST_SEED);
	const priv = wallet.derivePath(getPathStr(path)).privateKey;
	const msg = ethPersonalSignMsg(_msg);
	const hash = Buffer.from(Hash.keccak256(Buffer.from(msg)));
	const sig = ecsign(hash, priv);
	const v = (sig.v - 27).toString(16).padStart(2, "0");
	return `${sig.r.toString("hex")}${sig.s.toString("hex")}${v}`;
}

export function signEip712JS(payload: any, path: SigningPath) {
	const bip32 = BIP32Factory(ecc);
	const wallet = bip32.fromSeed(TEST_SEED);
	const priv = wallet.derivePath(getPathStr(path)).privateKey;
	// Calculate the EIP712 hash using the same method as the SDK validation
	const hash = TypedDataUtils.eip712Hash(payload, SignTypedDataVersion.V4);
	const sig = ecsign(Buffer.from(hash), priv);
	const v = (sig.v - 27).toString(16).padStart(2, "0");
	return `${sig.r.toString("hex")}${sig.s.toString("hex")}${v}`;
}
