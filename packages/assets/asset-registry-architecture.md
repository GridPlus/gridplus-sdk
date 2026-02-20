# Asset Registry Architecture (SDK + Asset Packages)

## 1) Component View

```mermaid
flowchart LR
    App["Consumer App"] --> Setup["setup(...)"]
    App --> Helpers["api/signing.ts\napi/addresses.ts"]

    subgraph SDK["@gridplus/sdk"]
      Setup --> RuntimeCfg["configureAssetRuntime(...)"]
      Setup --> DiscoverCall["discoverAndRegisterAssets({force:true})"]
      Setup --> CustomReg["registerConfiguredAssetPlugins(...)"]
      Helpers --> UseAsset["useAsset(assetId, options)"]
      UseAsset --> Registry["assets/registry.ts"]
      Registry --> Ctx["createDeviceContext()"]
      Ctx --> Runtime["queue/getClient/constants/services"]
      DiscoverCall --> Discovery["assets/discovery.ts"]
      Discovery --> Manifest["assets/defaultManifest.ts"]
    end

    subgraph Core["@gridplus/asset-core"]
      CoreRegistry["createAssetRegistry()\nAssetPlugin + DeviceId + resolve()"]
    end

    subgraph Assets["@gridplus/{btc,evm,solana,cosmos}"]
      Btc["btc/src/devices/lattice.ts\nlatticePlugin"]
      Evm["evm/src/devices/lattice.ts\nlatticePlugin"]
      Sol["solana/src/devices/lattice.ts\nlatticePlugin"]
      Cos["cosmos/src/devices/lattice.ts\nlatticePlugin"]
      Cadix["future: */src/devices/cadix.ts\ncadixPlugin"]
    end

    Registry --> CoreRegistry
    Manifest --> Btc
    Manifest --> Evm
    Manifest --> Sol
    Manifest --> Cos
    CustomReg --> Cadix

    Registry --> Plugin["resolved plugin (assetId:device)"]
    Plugin --> Signer["createSigner(context)"]
    Signer --> Adapter["module.create(...) or createAdapter(...)"]
    Adapter --> Device["Client calls via queue(...)"]
```

## 2) Runtime Flow (Setup + Use)

```mermaid
sequenceDiagram
    participant App
    participant Setup as setup()
    participant Registry as assets/registry.ts
    participant Discovery as assets/discovery.ts
    participant Manifest as defaultManifest.ts
    participant API as signing/addresses helpers
    participant Plugin as AssetPlugin
    participant Device as Client

    App->>Setup: setup({autoRegisterAssets, defaultDevice, assetPlugins})
    Setup->>Registry: configureAssetRuntime(..., resetCache=true)

    alt autoRegisterAssets != false
      Setup->>Registry: discoverAndRegisterAssets({force:true})
      Registry->>Discovery: discover(registerFn)
      Discovery->>Manifest: iterate DEFAULT_ASSET_PLUGINS
      loop each default plugin
        Discovery->>Registry: register if missing
      end
    end

    opt assetPlugins provided
      Setup->>Registry: unregisterAsset(key) if existing
      Setup->>Registry: registerAssetPlugin(plugin) // override
    end

    App->>API: sign*/fetch* request
    API->>Registry: useAsset(assetId, {device?, adapterOptions?})
    Registry->>Registry: resolve(assetId, device/defaultDevice)

    alt cache miss or generation changed
      Registry->>Plugin: createSigner(createDeviceContext())
      Plugin-->>Registry: signer
      Registry->>Plugin: createAdapter(...) or module.create(...)
      Plugin-->>Registry: adapter
    else cache hit
      Registry-->>Registry: reuse signer + adapter
    end

    Registry-->>API: adapter
    API->>Device: queue(client => sign/getAddresses/...)
    Device-->>API: result
```

## 3) Registry + Cache Lifecycle

```mermaid
stateDiagram-v2
    [*] --> RuntimeConfigured: configureAssetRuntime()

    RuntimeConfigured --> BuiltInsRegistered: discoverAndRegisterAssets()\n(autoRegisterAssets=true)
    RuntimeConfigured --> RuntimeConfigured: discoverAndRegisterAssets()\n(autoRegisterAssets=false)

    BuiltInsRegistered --> BuiltInsRegistered: discoverAndRegisterAssets()\n(idempotent)
    BuiltInsRegistered --> Overridden: setup({assetPlugins}) override

    Overridden --> Overridden: useAsset() cache hit
    Overridden --> CacheRebuilt: useAsset() cache miss
    CacheRebuilt --> Overridden: adapter memoized

    Overridden --> RuntimeConfigured: invalidateAssetCache()\nunregisterAsset()\nsetup(resetCache=true)
    RuntimeConfigured --> [*]
```

## 4) Behavior Matrix

| Scenario | Behavior |
| :-- | :-- |
| `autoRegisterAssets: true` | Built-in manifest plugins are registered during `setup()`. |
| `autoRegisterAssets: false` | Built-ins are skipped; only explicit plugins exist. |
| Custom `assetPlugins` collides with built-in key | Existing key is unregistered, then custom plugin is registered (override). |
| Duplicate keys inside `assetPlugins` input | `setup()` throws. |
| Discovery registration failure for one default plugin | Warning logged; discovery continues with remaining plugins. |
| `useAsset` unresolved asset/device | Throws with available device list for that asset (if any). |

## 5) Source Map

- `packages/sdk/src/api/setup.ts`
- `packages/sdk/src/api/signing.ts`
- `packages/sdk/src/api/addresses.ts`
- `packages/sdk/src/assets/registry.ts`
- `packages/sdk/src/assets/discovery.ts`
- `packages/sdk/src/assets/defaultManifest.ts`
- `packages/sdk/src/assets/context.ts`
- `packages/assets/asset-core/src/index.ts`
- `packages/assets/btc/src/devices/lattice.ts`
- `packages/assets/evm/src/devices/lattice.ts`
- `packages/assets/solana/src/devices/lattice.ts`
- `packages/assets/cosmos/src/devices/lattice.ts`
