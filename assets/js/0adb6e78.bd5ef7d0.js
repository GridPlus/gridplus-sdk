"use strict";(self.webpackChunkgridplus_sdk_docs=self.webpackChunkgridplus_sdk_docs||[]).push([[2942],{3905:function(e,t,n){n.d(t,{Zo:function(){return l},kt:function(){return m}});var r=n(7294);function s(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){s(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function d(e,t){if(null==e)return{};var n,r,s=function(e,t){if(null==e)return{};var n,r,s={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(s[n]=e[n]);return s}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(s[n]=e[n])}return s}var o=r.createContext({}),p=function(e){var t=r.useContext(o),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},l=function(e){var t=p(e.components);return r.createElement(o.Provider,{value:t},e.children)},u={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},c=r.forwardRef((function(e,t){var n=e.components,s=e.mdxType,a=e.originalType,o=e.parentName,l=d(e,["components","mdxType","originalType","parentName"]),c=p(n),m=s,k=c["".concat(o,".").concat(m)]||c[m]||u[m]||a;return n?r.createElement(k,i(i({ref:t},l),{},{components:n})):r.createElement(k,i({ref:t},l))}));function m(e,t){var n=arguments,s=t&&t.mdxType;if("string"==typeof e||s){var a=n.length,i=new Array(a);i[0]=c;var d={};for(var o in t)hasOwnProperty.call(t,o)&&(d[o]=t[o]);d.originalType=e,d.mdxType="string"==typeof e?e:s,i[1]=d;for(var p=2;p<a;p++)i[p]=n[p];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}c.displayName="MDXCreateElement"},7622:function(e,t,n){n.r(t),n.d(t,{assets:function(){return l},contentTitle:function(){return o},default:function(){return m},frontMatter:function(){return d},metadata:function(){return p},toc:function(){return u}});var r=n(7462),s=n(3366),a=(n(7294),n(3905)),i=["components"],d={id:"addresses",sidebar_position:2},o="\ud83d\udd11 Addresses and Public Keys",p={unversionedId:"addresses",id:"addresses",title:"\ud83d\udd11 Addresses and Public Keys",description:"Once your Client instance is connected, you can request a few different address and key types from the Lattice.",source:"@site/docs/addresses.md",sourceDirName:".",slug:"/addresses",permalink:"/gridplus-sdk/addresses",draft:!1,editUrl:"https://github.com/gridplus/gridplus-sdk/docs/addresses.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{id:"addresses",sidebar_position:2},sidebar:"sidebar",previous:{title:"\ud83d\udc4b Getting Started",permalink:"/gridplus-sdk/"},next:{title:"\ud83e\uddfe Signing Messages",permalink:"/gridplus-sdk/signing"}},l={},u=[{value:"\u039e Ethereum-type addresses",id:"\u03be-ethereum-type-addresses",level:2},{value:"Example: requesting Ethereum addresses",id:"example-requesting-ethereum-addresses",level:3},{value:"\u20bf Bitcoin addresses",id:"-bitcoin-addresses",level:2},{value:"Example: requesting BTC segwit addresse",id:"example-requesting-btc-segwit-addresse",level:3},{value:"\ud83d\udddd\ufe0f Public Keys",id:"\ufe0f-public-keys",level:2},{value:"1\ufe0f\u20e3 <code>secp256k1</code> curve",id:"1\ufe0f\u20e3-secp256k1-curve",level:3},{value:"Example: requesting secp256k1 public key",id:"example-requesting-secp256k1-public-key",level:4},{value:"2\ufe0f\u20e3 <code>ed25519</code> curve",id:"2\ufe0f\u20e3-ed25519-curve",level:3}],c={toc:u};function m(e){var t=e.components,n=(0,s.Z)(e,i);return(0,a.kt)("wrapper",(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"-addresses-and-public-keys"},"\ud83d\udd11 Addresses and Public Keys"),(0,a.kt)("p",null,"Once your ",(0,a.kt)("inlineCode",{parentName:"p"},"Client")," instance is connected, you can request a few different address and key types from the Lattice."),(0,a.kt)("admonition",{type:"note"},(0,a.kt)("p",{parentName:"admonition"},"This section uses the following notation when discussing BIP32 derivation paths: ",(0,a.kt)("inlineCode",{parentName:"p"},"[ purpose, coin_type, account, change, address ]"),". It also uses ",(0,a.kt)("inlineCode",{parentName:"p"},"'"),' to represent a "hardened", index, which is just ',(0,a.kt)("inlineCode",{parentName:"p"},"0x80000000 + index"),".")),(0,a.kt)("h2",{id:"\u03be-ethereum-type-addresses"},"\u039e Ethereum-type addresses"),(0,a.kt)("p",null,"These addresses are 20-byte hex strings prefixed with ",(0,a.kt)("inlineCode",{parentName:"p"},"0x"),". Lattice firmware places some restrictions based on derivation path, specifically that the ",(0,a.kt)("inlineCode",{parentName:"p"},"coin_type")," must be supported (Ethereum uses coin type ",(0,a.kt)("inlineCode",{parentName:"p"},"60'"),")."),(0,a.kt)("p",null,"In practice, most apps just use the standard Ethereum ",(0,a.kt)("inlineCode",{parentName:"p"},"coin_type")," (",(0,a.kt)("inlineCode",{parentName:"p"},"60'"),") when requesting addresses for other networks, but we do support some others (a vestige of an integration -- you probably won't ever need to use these): "),(0,a.kt)("blockquote",null,(0,a.kt)("p",{parentName:"blockquote"},(0,a.kt)("inlineCode",{parentName:"p"},"966', 700', 9006', 9005', 1007', 178', 137', 3731', 1010', 61', 108', 40', 889', 1987', 820', 6060', 1620', 1313114', 76', 246529', 246785', 1001', 227', 916', 464', 2221', 344', 73799', 246'"))),(0,a.kt)("p",null,"Keep in mind that changing the ",(0,a.kt)("inlineCode",{parentName:"p"},"coin_type")," will change all the requested addresses relative to Ethereum. This is why, in practice, most apps just use the Ethereum path."),(0,a.kt)("h3",{id:"example-requesting-ethereum-addresses"},"Example: requesting Ethereum addresses"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"const reqData = {\n startPath: [   // Derivation path of the first requested address\n   0x80000000 + 44,\n   0x80000000 + 60,\n   0x80000000,\n   0,\n   0,\n ],\n n: 5,          // Number of sequential addresses on specified path to return (max 10)\n};\n\nconst addrs = await client.getAddresses(reqData);\n")),(0,a.kt)("h2",{id:"-bitcoin-addresses"},"\u20bf Bitcoin addresses"),(0,a.kt)("p",null,"The Lattice can also export Bitcoin formatted addresses. There are three types of addresses that can be fetched and the type is determined by the ",(0,a.kt)("inlineCode",{parentName:"p"},"purpose")," index of the BIP32 derivation path."),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},"If ",(0,a.kt)("inlineCode",{parentName:"li"},"purpose = 44'"),", ",(0,a.kt)("em",{parentName:"li"},"legacy")," addresses (beginning with ",(0,a.kt)("inlineCode",{parentName:"li"},"1"),") will be returned"),(0,a.kt)("li",{parentName:"ul"},"If ",(0,a.kt)("inlineCode",{parentName:"li"},"purpose = 49'"),", ",(0,a.kt)("em",{parentName:"li"},"wrapped segwit")," addresses (beginning with ",(0,a.kt)("inlineCode",{parentName:"li"},"3"),") will be returned"),(0,a.kt)("li",{parentName:"ul"},"If ",(0,a.kt)("inlineCode",{parentName:"li"},"purpose = 84'"),", ",(0,a.kt)("em",{parentName:"li"},"segwit v1")," addresses (beginning with ",(0,a.kt)("inlineCode",{parentName:"li"},"bc1"),") will be returned")),(0,a.kt)("p",null,"Keep in mind that ",(0,a.kt)("inlineCode",{parentName:"p"},"coin_type")," ",(0,a.kt)("inlineCode",{parentName:"p"},"0'")," is required when requesting BTC addresses."),(0,a.kt)("h3",{id:"example-requesting-btc-segwit-addresse"},"Example: requesting BTC segwit addresse"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"const reqData = {\n startPath: [   // Derivation path of the first requested address\n   0x80000000 + 84,\n   0x80000000,\n   0x80000000,\n   0,\n   0,\n ]\n};\n\n// `n` will be set to 1 if not specified -> 1 address returned\nconst addr0 = await client.getAddresses(reqData);\n")),(0,a.kt)("h2",{id:"\ufe0f-public-keys"},"\ud83d\udddd\ufe0f Public Keys"),(0,a.kt)("p",null,"In addition to formatted addresses, the Lattice can return public keys on any supported curve for any BIP32 derivation path."),(0,a.kt)("admonition",{type:"note"},(0,a.kt)("p",{parentName:"admonition"},"Currently the derivation path must be at least 2 indices deep, but this restriction may be removed in the future.")),(0,a.kt)("p",null,"For requesting public keys it is best to import ",(0,a.kt)("inlineCode",{parentName:"p"},"Constants")," with:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"import { Client, Constants } from 'gridplus-sdk'\n")),(0,a.kt)("h3",{id:"1\ufe0f\u20e3-secp256k1-curve"},"1\ufe0f\u20e3 ",(0,a.kt)("inlineCode",{parentName:"h3"},"secp256k1")," curve"),(0,a.kt)("p",null,"Used by Bitcoin, Ethereum, and most blockchains."),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Pubkey size: 65 bytes")),(0,a.kt)("p",null,"The public key has two 32 byte components and is of format: ",(0,a.kt)("inlineCode",{parentName:"p"},"04{X}{Y}"),", meaning every public key is prefixed with a ",(0,a.kt)("inlineCode",{parentName:"p"},"04")," byte."),(0,a.kt)("h4",{id:"example-requesting-secp256k1-public-key"},"Example: requesting secp256k1 public key"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"const req = {\n  startPath: [   // Derivation path of the first requested pubkey\n    0x80000000 + 44,\n    0x80000000 + 60,\n    0x80000000,\n    0,\n    0,\n  ],\n  n: 3,\n  flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,\n};\n\nconst pubkeys = await client.getAddresses(req);\n")),(0,a.kt)("admonition",{type:"note"},(0,a.kt)("p",{parentName:"admonition"},"Since ",(0,a.kt)("inlineCode",{parentName:"p"},"startPath")," is the same, this example returns public keys which can be converted to Ethereum addresses to yield the same result as the above request to fetch Ethereum addresses.")),(0,a.kt)("h3",{id:"2\ufe0f\u20e3-ed25519-curve"},"2\ufe0f\u20e3 ",(0,a.kt)("inlineCode",{parentName:"h3"},"ed25519")," curve"),(0,a.kt)("p",null,"Used by Solana and a few others. ",(0,a.kt)("strong",{parentName:"p"},(0,a.kt)("em",{parentName:"strong"},"Ed25519 requires all derivation path indices be hardened."))),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Pubkey size: 32 bytes")),(0,a.kt)("admonition",{type:"note"},(0,a.kt)("p",{parentName:"admonition"},"Some libraries prefix these keys with a ",(0,a.kt)("inlineCode",{parentName:"p"},"00")," byte (making them 33 bytes), but we do ",(0,a.kt)("strong",{parentName:"p"},"not")," return keys with this prefix.")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"const req = {\n  startPath: [   // Derivation path of the first requested pubkey\n    0x80000000 + 44,\n    0x80000000 + 60,\n    0x80000000,\n  ],\n  n: 3,\n  flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,\n};\n\nconst pubkeys = await client.getAddresses(req);\n")))}m.isMDXComponent=!0}}]);