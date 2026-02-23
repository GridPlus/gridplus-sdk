# Chain Registry Architecture (SDK + Chain Packages)

## 1) Component View

```mermaid
flowchart LR
    App["Consumer App"] --> Setup["setup(...)"]
    App --> Helpers["api/signing.ts\napi/addresses.ts"]

    subgraph SDK["@gridplus/sdk"]
      Setup --> RuntimeCfg["configureChainRuntime(...)"]
      Setup --> DiscoverCall["discoverAndRegisterChains({force:true})"]
      Setup --> CustomReg["registerConfiguredChainPlugins(...)"]
      Helpers --> UseChain["useChain(chainId, options)"]
      UseChain --> Registry["chains/registry.ts"]
      Registry --> Ctx["createDeviceContext()"]
      Ctx --> Runtime["queue/getClient/constants/services"]
      DiscoverCall --> Discovery["chains/discovery.ts"]
      Discovery --> Manifest["chains/defaultManifest.ts"]
    end

    subgraph Core["@gridplus/chain-core"]
      CoreRegistry["createChainRegistry()\nChainPlugin + DeviceId + resolve()"]
    end

    subgraph Chains["@gridplus/{btc,evm,solana,cosmos,xrp}"]
      Btc["btc/src/devices/lattice.ts\nlatticePlugin"]
      Evm["evm/src/devices/lattice.ts\nlatticePlugin"]
      Sol["solana/src/devices/lattice.ts\nlatticePlugin"]
      Cos["cosmos/src/devices/lattice.ts\nlatticePlugin"]
      Xrp["xrp/src/devices/lattice.ts\nlatticePlugin"]
      Cadix["future: */src/devices/cadix.ts\ncadixPlugin"]
    end

    Registry --> CoreRegistry
    Manifest --> Btc
    Manifest --> Evm
    Manifest --> Sol
    Manifest --> Cos
    Manifest --> Xrp
    CustomReg --> Cadix

    Registry --> Plugin["resolved plugin (chainId:device)"]
    Plugin --> Signer["createSigner(context)"]
    Signer --> Adapter["module.create(...) or createAdapter(...)"]
    Adapter --> Device["Client calls via queue(...)"]
```

## 2) Runtime Flow (Setup + Use)

```mermaid
sequenceDiagram
    participant App
    participant Setup as setup()
    participant Registry as chains/registry.ts
    participant Discovery as chains/discovery.ts
    participant Manifest as defaultManifest.ts
    participant API as signing/addresses helpers
    participant Plugin as ChainPlugin
    participant Device as Client

    App->>Setup: setup({autoRegisterChains, defaultDevice, chainPlugins})
    Setup->>Registry: configureChainRuntime(..., resetCache=true)

    alt autoRegisterChains != false
      Setup->>Registry: discoverAndRegisterChains({force:true})
      Registry->>Discovery: discover(registerFn)
      Discovery->>Manifest: iterate DEFAULT_CHAIN_PLUGINS
      loop each default plugin
        Discovery->>Registry: register if missing
      end
    end

    opt chainPlugins provided
      Setup->>Registry: unregisterChain(key) if existing
      Setup->>Registry: registerChainPlugin(plugin) // override
    end

    App->>API: sign*/fetch* request
    API->>Registry: useChain(chainId, {device?, adapterOptions?})
    Registry->>Registry: resolve(chainId, device/defaultDevice)

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
    [*] --> RuntimeConfigured: configureChainRuntime()

    RuntimeConfigured --> BuiltInsRegistered: discoverAndRegisterChains()\n(autoRegisterChains=true)
    RuntimeConfigured --> RuntimeConfigured: discoverAndRegisterChains()\n(autoRegisterChains=false)

    BuiltInsRegistered --> BuiltInsRegistered: discoverAndRegisterChains()\n(idempotent)
    BuiltInsRegistered --> Overridden: setup({chainPlugins}) override

    Overridden --> Overridden: useChain() cache hit
    Overridden --> CacheRebuilt: useChain() cache miss
    CacheRebuilt --> Overridden: adapter memoized

    Overridden --> RuntimeConfigured: invalidateChainCache()\nunregisterChain()\nsetup(resetCache=true)
    RuntimeConfigured --> [*]
```

## 4) Behavior Matrix

| Scenario | Behavior |
| :-- | :-- |
| `autoRegisterChains: true` | Built-in manifest plugins are registered during `setup()`. |
| `autoRegisterChains: false` | Built-ins are skipped; only explicit plugins exist. |
| Custom `chainPlugins` collides with built-in key | Existing key is unregistered, then custom plugin is registered (override). |
| Duplicate keys inside `chainPlugins` input | `setup()` throws. |
| Discovery registration failure for one default plugin | Warning logged; discovery continues with remaining plugins. |
| `useChain` unresolved chain/device | Throws with available device list for that chain (if any). |

## 5) Source Map

- `packages/sdk/src/api/setup.ts`
- `packages/sdk/src/api/signing.ts`
- `packages/sdk/src/api/addresses.ts`
- `packages/sdk/src/chains/registry.ts`
- `packages/sdk/src/chains/discovery.ts`
- `packages/sdk/src/chains/defaultManifest.ts`
- `packages/sdk/src/chains/context.ts`
- `packages/chains/chain-core/src/index.ts`
- `packages/chains/btc/src/devices/lattice.ts`
- `packages/chains/evm/src/devices/lattice.ts`
- `packages/chains/solana/src/devices/lattice.ts`
- `packages/chains/cosmos/src/devices/lattice.ts`
- `packages/chains/xrp/src/devices/lattice.ts`
