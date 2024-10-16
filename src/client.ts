import { buildSaveClientFn } from './api/utilities';
import {
  BASE_URL,
  DEFAULT_ACTIVE_WALLETS,
  EMPTY_WALLET_UID,
  getFwVersionConst,
} from './constants';
import {
  addKvRecords,
  connect,
  fetchActiveWallet,
  fetchEncData,
  getAddresses,
  getKvRecords,
  pair,
  removeKvRecords,
  sign,
} from './functions/index';
import { buildRetryWrapper } from './shared/functions';
import { getPubKeyBytes } from './shared/utilities';
import { validateEphemeralPub } from './shared/validators';
import { getP256KeyPair, getP256KeyPairFromPub, randomBytes } from './util';

/**
 * `Client` is a class-based interface for managing a Lattice device.
 *
 * @deprecated
 * - This class is deprecated for external use. It is used internally by the SDK to manage
 * the state of the connection to the Lattice device. It is not recommended to use this class directly.
 * The recommended way to interact with the Lattice is through the functional interface.
 * - See the [`src/api` directory on GitHub](https://github.com/GridPlus/gridplus-sdk/tree/dev/src/api)
 *  or [learn more in the docs](https://gridplus.github.io/gridplus-sdk/).
 *
 */
export class Client {
  /** Is the Lattice paired with this Client. */
  public isPaired: boolean;
  /** The time to wait for a response before cancelling. */
  public timeout: number;
  /** The base of the remote url to which the SDK sends requests. */
  public baseUrl: string;
  /** @internal The `baseUrl` plus the `deviceId`. Set in {@link connect} when it completes successfully.  */
  public url?: string;
  /** `name` is a human readable string associated with this app on the Lattice */
  private name: string;
  private key: KeyPair;
  /**`privKey` is used to generate a keypair, which is used for maintaining an encrypted messaging channel with the target Lattice  */
  private privKey: Buffer | string;
  private retryCount: number;
  private fwVersion?: Buffer;
  private skipRetryOnWrongWallet: boolean;
  /** Temporary secret that is generated by the Lattice device */
  private _ephemeralPub: KeyPair;
  /** The ID of the connected Lattice */
  private deviceId?: string;
  /** Information about the current wallet. Should be null unless we know a wallet is present */
  public activeWallets: ActiveWallets;
  /** A wrapper function for handling retries and injecting the {@link Client} class  */
  private retryWrapper: (fn: any, params?: any) => Promise<any>;
  /** Function to set the stored client data */
  private setStoredClient: (clientData: string | null) => void;

  /**
   * @param params - Parameters are passed as an object.
   */
  constructor({
    baseUrl,
    name,
    privKey,
    stateData,
    timeout,
    retryCount,
    skipRetryOnWrongWallet,
    deviceId,
    setStoredClient,
  }: {
    /** The base URL of the signing server. */
    baseUrl?: string;
    /** The name of the client. */
    name?: string;
    /** The private key of the client.*/
    privKey?: Buffer | string;
    /** Number of times to retry a request if it fails. */
    retryCount?: number;
    /** The time to wait for a response before cancelling. */
    timeout?: number;
    /** User can pass in previous state data to rehydrate connected session */
    stateData?: string;
    /** If true we will not retry if we get a wrong wallet error code */
    skipRetryOnWrongWallet?: boolean;
    /** The ID of the connected Lattice */
    deviceId?: string;
    /** Function to set the stored client data */
    setStoredClient?: (clientData: string | null) => void;
  }) {
    this.name = name || 'Unknown';
    this.baseUrl = baseUrl || BASE_URL;
    this.deviceId = deviceId;
    this.isPaired = false;
    this.activeWallets = DEFAULT_ACTIVE_WALLETS;
    this.timeout = timeout || 60000;
    this.retryCount = retryCount || 3;
    this.skipRetryOnWrongWallet = skipRetryOnWrongWallet || false;
    this.privKey = privKey || randomBytes(32);
    this.key = getP256KeyPair(this.privKey);
    this.retryWrapper = buildRetryWrapper(this, this.retryCount);
    this.setStoredClient = setStoredClient
      ? buildSaveClientFn(setStoredClient)
      : undefined;

    /** The user may pass in state data to rehydrate a session that was previously cached */
    if (stateData) {
      this.unpackAndApplyStateData(stateData);
    }
  }

  /**
   * Get the public key associated with the client's static keypair.
   * The public key is used for identifying the client to the Lattice.
   * @internal
   * @returns Buffer
   */
  public get publicKey() {
    return getPubKeyBytes(this.key);
  }

  /**
   * Get the pairing name for this client instance
   */
  public getAppName() {
    return this.name;
  }

  /**
   * Get the `deviceId` for this client instance
   */
  public getDeviceId() {
    return this.deviceId;
  }

  /**
   * Get the shared secret, derived via ECDH from the local private key and the ephemeral public key
   * @internal
   * @returns Buffer
   */
  public get sharedSecret() {
    // Once every ~256 attempts, we will get a key that starts with a `00` byte, which can lead to
    // problems initializing AES if we don't force a 32 byte BE buffer.
    return Buffer.from(
      this.key.derive(this.ephemeralPub.getPublic()).toArray('be', 32),
    );
  }

  /** @internal */
  public get ephemeralPub() {
    return this._ephemeralPub;
  }

  /** @internal */
  public set ephemeralPub(ephemeralPub: KeyPair) {
    validateEphemeralPub(ephemeralPub);
    this._ephemeralPub = ephemeralPub;
  }

  /**
   * Attempt to contact a device based on its `deviceId`. The response should include an ephemeral
   * public key, which is used to pair with the device in a later request.
   * @category Lattice
   */
  public async connect(deviceId: string) {
    return this.retryWrapper(connect, { id: deviceId });
  }

  /**
   * If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
   * pairing secret. It then sends the name and signature to the device. If no pairing secret is
   * provided, `pair` sends a zero-length name buffer to the device.
   * @category Lattice
   */
  public async pair(pairingSecret: string) {
    return this.retryWrapper(pair, { pairingSecret });
  }

  /**
   * Takes a starting path and a number to get the addresses associated with the active wallet.
   * @category Lattice
   */
  public async getAddresses({
    startPath,
    n = 1,
    flag = 0,
    iterIdx = 0,
  }: GetAddressesRequestParams): Promise<Buffer[] | string[]> {
    return this.retryWrapper(getAddresses, { startPath, n, flag, iterIdx });
  }

  /**
   * Builds and sends a request for signing to the Lattice.
   * @category Lattice
   */
  public async sign({
    data,
    currency,
    cachedData,
    nextCode,
  }: SignRequestParams): Promise<SignData> {
    return this.retryWrapper(sign, { data, currency, cachedData, nextCode });
  }

  /**
   * Fetch the active wallet in the Lattice.
   */
  public async fetchActiveWallet(): Promise<ActiveWallets> {
    return this.retryWrapper(fetchActiveWallet);
  }

  /**
   * Takes in a set of key-value records and sends a request to add them to the Lattice.
   * @category Lattice
   */
  async addKvRecords({
    type = 0,
    records,
    caseSensitive = false,
  }: AddKvRecordsRequestParams): Promise<Buffer> {
    return this.retryWrapper(addKvRecords, { type, records, caseSensitive });
  }

  /**
   * Fetches a list of key-value records from the Lattice.
   * @category Lattice
   */
  public async getKvRecords({
    type = 0,
    n = 1,
    start = 0,
  }: GetKvRecordsRequestParams): Promise<GetKvRecordsData> {
    return this.retryWrapper(getKvRecords, { type, n, start });
  }

  /**
   * Takes in an array of ids and sends a request to remove them from the Lattice.
   * @category Lattice
   */
  public async removeKvRecords({
    type = 0,
    ids = [],
  }: RemoveKvRecordsRequestParams): Promise<Buffer> {
    return this.retryWrapper(removeKvRecords, { type, ids });
  }

  /**
   * Fetch a record of encrypted data from the Lattice.
   * Must specify a data type. Returns a Buffer containing
   * data formatted according to the specified type.
   * @category Lattice
   */
  public async fetchEncryptedData(
    params: FetchEncDataRequest,
  ): Promise<Buffer> {
    return this.retryWrapper(fetchEncData, params);
  }

  /** Get the active wallet */
  public getActiveWallet() {
    if (
      this.activeWallets.external.uid &&
      !EMPTY_WALLET_UID.equals(this.activeWallets.external.uid)
    ) {
      return this.activeWallets.external;
    } else if (
      this.activeWallets.internal.uid &&
      !EMPTY_WALLET_UID.equals(this.activeWallets.internal.uid)
    ) {
      return this.activeWallets.internal;
    } else {
      return undefined;
    }
  }

  /** Check if the user has an active wallet */
  public hasActiveWallet() {
    return !!this.getActiveWallet();
  }

  /**
   * Reset the active wallets to empty values.
   * @category Device Response
   * @internal
   */
  public resetActiveWallets() {
    this.activeWallets = DEFAULT_ACTIVE_WALLETS;
  }

  /**
   * Get a JSON string containing state data that can be used to rehydrate a session. Pass the
   * contents of this to the constructor as `stateData` to rehydrate.
   * @internal
   */
  public getStateData() {
    return this.packStateData();
  }

  /**
   * Returns the firmware version constants for the given firmware version.
   * @internal
   */
  public getFwConstants() {
    return getFwVersionConst(this.fwVersion ?? Buffer.alloc(0));
  }

  /**
   * `getFwVersion` gets the firmware version of the paired device.
   * @internal
   */
  public getFwVersion(): {
    fix: number;
    minor: number;
    major: number;
  } {
    if (this.fwVersion && this.fwVersion.length >= 3) {
      return {
        fix: this.fwVersion[0],
        minor: this.fwVersion[1],
        major: this.fwVersion[2],
      };
    }
    return { fix: 0, minor: 0, major: 0 };
  }

  /**
   * Handles the mutation of Client state in the primary functions.
   */
  public mutate({
    deviceId,
    ephemeralPub,
    url,
    isPaired,
    fwVersion,
    activeWallets,
  }: {
    deviceId?: string;
    ephemeralPub?: Buffer;
    url?: string;
    isPaired?: boolean;
    fwVersion?: Buffer;
    activeWallets?: ActiveWallets;
  }) {
    if (deviceId !== undefined) this.deviceId = deviceId;
    if (ephemeralPub !== undefined) this.ephemeralPub = ephemeralPub;
    if (url !== undefined) this.url = url;
    if (isPaired !== undefined) this.isPaired = isPaired;
    if (fwVersion !== undefined) this.fwVersion = fwVersion;
    if (activeWallets !== undefined) this.activeWallets = activeWallets;

    if (this.setStoredClient) {
      this.setStoredClient(this.getStateData());
    }
  }

  /**
   * Return JSON-stringified version of state data. Can be used to rehydrate an SDK session without
   * reconnecting to the target Lattice.
   * @internal
   */
  private packStateData() {
    try {
      const data = {
        activeWallets: {
          internal: {
            uid: this.activeWallets.internal.uid?.toString('hex'),
            name: this.activeWallets.internal.name?.toString(),
            capabilities: this.activeWallets.internal.capabilities,
          },
          external: {
            uid: this.activeWallets.external.uid?.toString('hex'),
            name: this.activeWallets.external.name?.toString(),
            capabilities: this.activeWallets.external.capabilities,
          },
        },
        ephemeralPub: this.ephemeralPub?.getPublic()?.encode('hex'),
        fwVersion: this.fwVersion?.toString('hex'),
        deviceId: this.deviceId,
        name: this.name,
        baseUrl: this.baseUrl,
        privKey: this.privKey.toString('hex'),
        retryCount: this.retryCount,
        timeout: this.timeout,
      };
      return JSON.stringify(data);
    } catch (err) {
      console.warn('Could not pack state data.');
      return null;
    }
  }

  /**
   * Unpack a JSON-stringified version of state data and apply it to state. This will allow us to
   * rehydrate an old session.
   * @internal
   */
  private unpackAndApplyStateData(data: string) {
    try {
      const unpacked = JSON.parse(data);
      // Attempt to parse the data
      const internalWallet = {
        uid: Buffer.from(unpacked.activeWallets.internal.uid, 'hex'),
        name: unpacked.activeWallets.internal.name
          ? Buffer.from(unpacked.activeWallets.internal.name)
          : null,
        capabilities: unpacked.activeWallets.internal.capabilities,
        external: false,
      };
      const externalWallet = {
        uid: Buffer.from(unpacked.activeWallets.external.uid, 'hex'),
        name: unpacked.activeWallets.external.name
          ? Buffer.from(unpacked.activeWallets.external.name)
          : null,
        capabilities: unpacked.activeWallets.external.capabilities,
        external: true,
      };
      const ephemeralPubBytes = Buffer.from(unpacked.ephemeralPub, 'hex');
      const fwVersionBytes = Buffer.from(unpacked.fwVersion, 'hex');
      const privKeyBytes = Buffer.from(unpacked.privKey, 'hex');
      // Apply unpacked params
      this.activeWallets.internal = internalWallet;
      this.activeWallets.external = externalWallet;
      this.ephemeralPub = getP256KeyPairFromPub(ephemeralPubBytes);
      this.fwVersion = fwVersionBytes;
      this.deviceId = unpacked.deviceId;
      this.name = unpacked.name;
      this.baseUrl = unpacked.baseUrl;
      this.url = `${this.baseUrl}/${this.deviceId}`;
      this.privKey = privKeyBytes;
      this.key = getP256KeyPair(this.privKey);
      this.retryCount = unpacked.retryCount;
      this.timeout = unpacked.timeout;
      this.retryWrapper = buildRetryWrapper(this, this.retryCount);
    } catch (err) {
      console.warn('Could not apply state data.');
    }
  }
}
