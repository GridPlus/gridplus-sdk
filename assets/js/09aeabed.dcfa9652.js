"use strict";(self.webpackChunkgridplus_sdk_docs=self.webpackChunkgridplus_sdk_docs||[]).push([[5047],{3905:function(e,t,n){n.d(t,{Zo:function(){return d},kt:function(){return m}});var a=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function s(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,a,i=function(e,t){if(null==e)return{};var n,a,i={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var l=a.createContext({}),p=function(e){var t=a.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):s(s({},t),e)),n},d=function(e){var t=p(e.components);return a.createElement(l.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},g=a.forwardRef((function(e,t){var n=e.components,i=e.mdxType,r=e.originalType,l=e.parentName,d=o(e,["components","mdxType","originalType","parentName"]),g=p(n),m=i,u=g["".concat(l,".").concat(m)]||g[m]||c[m]||r;return n?a.createElement(u,s(s({ref:t},d),{},{components:n})):a.createElement(u,s({ref:t},d))}));function m(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var r=n.length,s=new Array(r);s[0]=g;var o={};for(var l in t)hasOwnProperty.call(t,l)&&(o[l]=t[l]);o.originalType=e,o.mdxType="string"==typeof e?e:i,s[1]=o;for(var p=2;p<r;p++)s[p]=n[p];return a.createElement.apply(null,s)}return a.createElement.apply(null,n)}g.displayName="MDXCreateElement"},9437:function(e,t,n){n.r(t),n.d(t,{assets:function(){return d},contentTitle:function(){return l},default:function(){return m},frontMatter:function(){return o},metadata:function(){return p},toc:function(){return c}});var a=n(7462),i=n(3366),r=(n(7294),n(3905)),s=["components"],o={id:"signing",sidebar_position:3},l="\ud83e\uddfe Signing Messages",p={unversionedId:"signing",id:"signing",title:"\ud83e\uddfe Signing Messages",description:"The Lattice1 is capable of signing messages (e.g. Ethereum transactions) on supported elliptic curves. For certain message types, Lattice firmware is capable of decoding and displaying the requests in more readable ways. All requests must include a derivation path and must be made against the current active wallet on the target Lattice; if a SafeCard is inserted and unlocked, it is considered the active wallet.",source:"@site/docs/signing.md",sourceDirName:".",slug:"/signing",permalink:"/gridplus-sdk/signing",draft:!1,editUrl:"https://github.com/gridplus/gridplus-sdk/docs/signing.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{id:"signing",sidebar_position:3},sidebar:"sidebar",previous:{title:"\ud83d\udd11 Addresses and Public Keys",permalink:"/gridplus-sdk/addresses"},next:{title:"\ud83d\udcdc Calldata Decoding",permalink:"/gridplus-sdk/tutorials/calldataDecoding"}},d={},c=[{value:"Example: General Signing",id:"example-general-signing",level:3},{value:"\ud83d\udcc3 Encoding Types",id:"-encoding-types",level:2},{value:"Example: EVM Encoding",id:"example-evm-encoding",level:3},{value:"Example: SOLANA Encoding",id:"example-solana-encoding",level:3},{value:"\u039e Ethereum (Transaction)",id:"\u03be-ethereum-transaction",level:2},{value:"\u039e Ethereum (Message)",id:"\u03be-ethereum-message",level:2},{value:"<code>personal_sign</code>",id:"personal_sign",level:4},{value:"Example: requesting signature on Ethereum <code>personal_sign</code> message",id:"example-requesting-signature-on-ethereum-personal_sign-message",level:4},{value:"<code>sign_typed_data</code>",id:"sign_typed_data",level:3},{value:"\u20bf Bitcoin",id:"-bitcoin",level:2},{value:"Example: requesting BTC transactions",id:"example-requesting-btc-transactions",level:3}],g={toc:c};function m(e){var t=e.components,n=(0,i.Z)(e,s);return(0,r.kt)("wrapper",(0,a.Z)({},g,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"-signing-messages"},"\ud83e\uddfe Signing Messages"),(0,r.kt)("p",null,"The Lattice1 is capable of signing messages (e.g. Ethereum transactions) on supported elliptic curves. For certain message types, Lattice firmware is capable of decoding and displaying the requests in more readable ways. All requests must include a ",(0,r.kt)("strong",{parentName:"p"},"derivation path")," and must be made against the ",(0,r.kt)("strong",{parentName:"p"},"current active wallet")," on the target Lattice; if a ",(0,r.kt)("a",{parentName:"p",href:"https://gridplus.io/safe-cards"},"SafeCard")," is inserted and unlocked, it is considered the active wallet."),(0,r.kt)("h1",{id:"\ufe0f-general-signing"},"\u270d\ufe0f General Signing"),(0,r.kt)("admonition",{type:"info"},(0,r.kt)("p",{parentName:"admonition"},"General signing was introduced Lattice firmare ",(0,r.kt)("inlineCode",{parentName:"p"},"v0.14.0"),". GridPlus plans on deprecating the legacy signing mode and replacing it with corresponding ",(0,r.kt)("a",{parentName:"p",href:"#encoding-types"},"Encoding Types"),". This document will be updated as that happens.")),(0,r.kt)("p",null,"General signing allows you to request a signature on ",(0,r.kt)("strong",{parentName:"p"},"any message")," from a private key derived on ",(0,r.kt)("strong",{parentName:"p"},"any supported curve"),". You will need to specify, at a minimum, a ",(0,r.kt)("inlineCode",{parentName:"p"},"Curve")," and a ",(0,r.kt)("inlineCode",{parentName:"p"},"Hash")," for your signing request. Options can be found in ",(0,r.kt)("a",{parentName:"p",href:"./api/modules/constants#external"},(0,r.kt)("inlineCode",{parentName:"a"},"Constants")),":"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"import { Constants } from `gridplus-sdk`\n")),(0,r.kt)("admonition",{type:"note"},(0,r.kt)("p",{parentName:"admonition"},"Some curves (e.g. ",(0,r.kt)("inlineCode",{parentName:"p"},"SECP256K1"),") require a hashing algorithm to be specified so that Lattice firmware can hash the message before signing. Other curves (e.g. ",(0,r.kt)("inlineCode",{parentName:"p"},"ED25519"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"BLS12_381_G2"),") hash the message as part of the signing process and require ",(0,r.kt)("inlineCode",{parentName:"p"},"curveType=NONE"),".")),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Param"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Location in ",(0,r.kt)("inlineCode",{parentName:"th"},"Constants")),(0,r.kt)("th",{parentName:"tr",align:"left"},"Options"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Curve"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Constants.SIGNING.CURVES")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"SECP256K1"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"ED25519"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"BLS12_381_G2")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Curve on which to derive the signer's private key")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Hash"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Constants.SIGNING.HASHES")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"KECCAK256"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"SHA256"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"NONE")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Hash to use prior to signing. Note that ",(0,r.kt)("inlineCode",{parentName:"td"},"ED25519")," and ",(0,r.kt)("inlineCode",{parentName:"td"},"BLS12_381_G2")," require ",(0,r.kt)("inlineCode",{parentName:"td"},"NONE")," as messages cannot be prehashed.")))),(0,r.kt)("h3",{id:"example-general-signing"},"Example: General Signing"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},'const msg = "I am the captain now"\nconst req = {\n  signerPath: [ 0x80000000 + 44, 0x80000000 + 60, 0x80000000, ];\n  curveType: Constants.SIGNING.CURVES.SECP256K1,\n  hashType: Constants.SIGNING.HASHES.KECCAK256,\n  payload: msg\n};\nconst sig = await client.sign(req)\n')),(0,r.kt)("h2",{id:"-encoding-types"},"\ud83d\udcc3 Encoding Types"),(0,r.kt)("p",null,"You may specify an ",(0,r.kt)("strong",{parentName:"p"},"Encoding Type")," in your signing request if you want the message to render the signing request in a ",(0,r.kt)("strong",{parentName:"p"},"formatted")," way, such as for an EVM transaction. If no encoding type is specified, the message will be displayed on the Lattice in full as either a hex or ASCII string, depending on the contents of the message. If you do specify an encoding type, the message ",(0,r.kt)("strong",{parentName:"p"},"must")," conform to the expected format (e.g. EVM transaction) or else Lattice firmware will reject the request."),(0,r.kt)("p",null,"Encoding Types can be accessed inside of ",(0,r.kt)("inlineCode",{parentName:"p"},"Constants"),":"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const encodings = Constants.SIGNING.ENCODINGS;\n")),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Encoding"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"NONE")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Can also use ",(0,r.kt)("inlineCode",{parentName:"td"},"null")," or not specify the ",(0,r.kt)("inlineCode",{parentName:"td"},"encodingType"),". Lattice will display either an ASCII or a hex string depending on the payload.")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"EVM")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Used to decode an EVM contract function call. To deploy a contract, set ",(0,r.kt)("inlineCode",{parentName:"td"},"to")," as ",(0,r.kt)("inlineCode",{parentName:"td"},"null"),".")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"SOLANA")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Used to decode a Solana transaction. Transactions that cannot be decoded will be rejected.")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"ETH_DEPOSIT")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Can be used to display a ",(0,r.kt)("a",{parentName:"td",href:"https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#depositdata"},(0,r.kt)("inlineCode",{parentName:"a"},"DepositData"))," signing root and associated validator public key in order to build deposit data for a new ETH2 validator.")))),(0,r.kt)("h3",{id:"example-evm-encoding"},"Example: EVM Encoding"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"// Create an `@ethereumjs/tx` object. Contents of `txData` are out of scope\n// for this example.\nimport { TransactionFactory } from '@ethereumjs/tx';\nconst tx = TransactionFactory.fromTxData(txData, { common: req.common });\n// Full, serialized EVM transaction\nconst msg = tx.getMessageToSign(false);\n\n// Build the request with the EVM encoding\nconst req = {\n  signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],\n  curveType: Constants.SIGNING.CURVES.SECP256K1,\n  hashType: Constants.SIGNING.HASHES.KECCAK256,\n  encodingType: Constants.SIGNING.ENCODINGS.EVM,\n  payload: msg,\n};\nconst sig = await client.sign(req)\n")),(0,r.kt)("h3",{id:"example-solana-encoding"},"Example: SOLANA Encoding"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},'// Setup the Solana transaction using `@solana/web3.js`.\n// The specifics are out of scope for this example.\nimport { Transaction, SystemProgram } from \'@solana/web3.js\';\nconst transfer = SystemProgram.transfer({\n  fromPubkey: "...",\n  toPubkey: "...",\n  lamports: 1234,\n})\nconst recentBlockhash = "...";\nconst tx = new Transaction({ recentBlockhash }).add(transfer);\n// Full, serialized Solana transaction\nconst msg = tx.compileMessage().serialize();\n\n// Build the request with the SOLANA encoding\nconst req = {\n  signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000],\n  curveType: Constants.SIGNING.CURVES.ED25519,\n  hashType: Constants.SIGNING.HASHES.NONE,\n  encodingType: Constants.SIGNING.ENCODINGS.SOLANA,\n  payload: msg\n};\nconst sig = await client.sign(req)\n')),(0,r.kt)("h1",{id:"-legacy-signing"},"\ud83d\udcdc Legacy Signing"),(0,r.kt)("p",null,"Prior to general signing, request data was sent to the Lattice in preformatted ways and was used to build the transaction in firmware. We are phasing out this mechanism, but for now it is how you request Ethereum, Bitcoin, and Ethereum-Message signatures. These signing methods are accessed using the ",(0,r.kt)("inlineCode",{parentName:"p"},"currency")," flag in the request data."),(0,r.kt)("h2",{id:"\u03be-ethereum-transaction"},"\u039e Ethereum (Transaction)"),(0,r.kt)("p",null,"All six Ethereum transactions must be specified in the request data along with a signer path."),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"Example: requesting signature on Ethereum transaction")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const txData = {\n  nonce: '0x02',\n  gasPrice: '0x1fe5d61a00',\n  gasLimit: '0x034e97',\n  to: '0x1af768c0a217804cfe1a0fb739230b546a566cd6',\n  value: '0x01cba1761f7ab9870c',\n  data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',\n}\n\nconst reqData = {\n  currency: 'ETH',\n  data: {\n    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],\n    ...txData,\n    chain: 5, // Defaults to 1 (i.e. mainnet)\n  }\n}\n\nconst sig = await client.sign(reqData)\n")),(0,r.kt)("h2",{id:"\u03be-ethereum-message"},"\u039e Ethereum (Message)"),(0,r.kt)("p",null,"Two message protocols are supported for Ethereum: ",(0,r.kt)("inlineCode",{parentName:"p"},"personal_sign")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"sign_typed_data"),"."),(0,r.kt)("h4",{id:"personal_sign"},(0,r.kt)("inlineCode",{parentName:"h4"},"personal_sign")),(0,r.kt)("p",null,"This is a protocol to display a simple, human readable message. It includes a prefix to avoid accidentally signing sensitive data. The message included should be a string."),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},(0,r.kt)("inlineCode",{parentName:"strong"},"protocol")," must be specified as ",(0,r.kt)("inlineCode",{parentName:"strong"},'"signPersonal"')),"."),(0,r.kt)("h4",{id:"example-requesting-signature-on-ethereum-personal_sign-message"},"Example: requesting signature on Ethereum ",(0,r.kt)("inlineCode",{parentName:"h4"},"personal_sign")," message"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const reqData = {\n  currency: 'ETH_MSG',\n  data: {\n    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],\n    protocol: 'signPersonal' // You must use this string to specify this protocol\n    payload: 'my message to sign'\n  }\n}\n\nconst sig = await client.sign(reqData)\n")),(0,r.kt)("h3",{id:"sign_typed_data"},(0,r.kt)("inlineCode",{parentName:"h3"},"sign_typed_data")),(0,r.kt)("p",null,"This is used in protocols such as ",(0,r.kt)("a",{parentName:"p",href:"https://eips.ethereum.org/EIPS/eip-712"},"EIP712"),". It is meant to be an encoding for JSON-like data that can be more human readable."),(0,r.kt)("admonition",{type:"note"},(0,r.kt)("p",{parentName:"admonition"},"Only ",(0,r.kt)("inlineCode",{parentName:"p"},"sign_typed_data")," V3 and V4 are supported.")),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},(0,r.kt)("inlineCode",{parentName:"strong"},"protocol")," must be specified as ",(0,r.kt)("inlineCode",{parentName:"strong"},'"eip712"')),"."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const message = {\n  hello: 'i am a message',\n  goodbye: 1\n}\nconst reqData = {\n  currency: 'ETH_MSG',\n  data: {\n    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],\n    protocol: 'eip712' // You must use this string to specify this protocol\n    payload: message\n  }\n}\n\nconst sig = await client.sign(reqData)\n")),(0,r.kt)("h2",{id:"-bitcoin"},"\u20bf Bitcoin"),(0,r.kt)("p",null,"Bitcoin transactions can be requested by including a set of UTXOs, which include the signer derivation path and spend type. The same ",(0,r.kt)("inlineCode",{parentName:"p"},"purpose")," values are used to determine how UTXOs should be signed:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"If ",(0,r.kt)("inlineCode",{parentName:"li"},"purpose = 44'"),", the input will be signed with p2pkh"),(0,r.kt)("li",{parentName:"ul"},"If ",(0,r.kt)("inlineCode",{parentName:"li"},"purpose = 49'"),", the input will signed with p2sh-p2wpkh"),(0,r.kt)("li",{parentName:"ul"},"If ",(0,r.kt)("inlineCode",{parentName:"li"},"purpose = 84'"),", the input will be signed with p2wpkh")),(0,r.kt)("p",null,"The ",(0,r.kt)("inlineCode",{parentName:"p"},"purpose")," of the ",(0,r.kt)("inlineCode",{parentName:"p"},"signerPath")," in the given previous output (a.k.a. UTXO) is used to make the above determination."),(0,r.kt)("h3",{id:"example-requesting-btc-transactions"},"Example: requesting BTC transactions"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},'const p2wpkhInputs = [\n  {\n    // Hash of transaction that produced this UTXO\n    txHash: "2aba3db3dc5b1b3ded7231d90fe333e184d24672eb0b6466dbc86228b8996112",\n    // Value of this UTXO in satoshis (1e8 sat = 1 BTC)\n    value: 100000,\n    // Index of this UTXO in the set of outputs in this transaction\n    index: 3,\n    // Owner of this UTXO. Since `purpose` is 84\' this will be spent with p2wpkh,\n    // meaning this is assumed to be a segwit address (starting with bc1)\n    signerPath: [0x80000000 + 84, 0x80000000, 0x80000000, 0, 12],\n  }\n]\n\nconst reqData = {\n  currency: "BTC",\n  data: {\n    prevOuts: p2wpkhInputs,\n    // Recipient can be any legacy, wrapped segwit, or segwit address\n    recipient: "1FKpGnhtR3ZrVcU8hfEdMe8NpweFb2sj5F",\n    // Value (in sats) must be <= (SUM(prevOuts) - fee)\n    value: 50000,\n    // Fee (in sats) goes to the miner\n    fee: 20000,\n    // SUM(prevOuts) - fee goes to the change recipient, which is an\n    // address derived in the same wallet. Again, the `purpose` in this path \n    // determines what address the BTC will be sent to, or more accurately how \n    // the UTXO is locked -- e.g., p2wpkh unlocks differently than p2sh-p2wpkh\n    changePath: [0x80000000 + 84, 0x80000000, 0x80000000, 1, 0],\n  }\n}\n\nconst sig = await client.sign(reqData)\n')))}m.isMDXComponent=!0}}]);