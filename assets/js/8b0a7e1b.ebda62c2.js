"use strict";(self.webpackChunkgridplus_sdk_docs=self.webpackChunkgridplus_sdk_docs||[]).push([[9121],{3905:function(e,t,n){n.d(t,{Zo:function(){return c},kt:function(){return g}});var a=n(7294);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function s(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?s(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):s(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},s=Object.keys(e);for(a=0;a<s.length;a++)n=s[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);for(a=0;a<s.length;a++)n=s[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var d=a.createContext({}),l=function(e){var t=a.useContext(d),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},c=function(e){var t=l(e.components);return a.createElement(d.Provider,{value:t},e.children)},u={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},p=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,s=e.originalType,d=e.parentName,c=o(e,["components","mdxType","originalType","parentName"]),p=l(n),g=r,m=p["".concat(d,".").concat(g)]||p[g]||u[g]||s;return n?a.createElement(m,i(i({ref:t},c),{},{components:n})):a.createElement(m,i({ref:t},c))}));function g(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var s=n.length,i=new Array(s);i[0]=p;var o={};for(var d in t)hasOwnProperty.call(t,d)&&(o[d]=t[d]);o.originalType=e,o.mdxType="string"==typeof e?e:r,i[1]=o;for(var l=2;l<s;l++)i[l]=n[l];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}p.displayName="MDXCreateElement"},4224:function(e,t,n){n.r(t),n.d(t,{assets:function(){return c},contentTitle:function(){return d},default:function(){return g},frontMatter:function(){return o},metadata:function(){return l},toc:function(){return u}});var a=n(7462),r=n(3366),s=(n(7294),n(3905)),i=["components"],o={},d="\ud83c\udff7\ufe0f Addresses Tags",l={unversionedId:"tutorials/addressTags",id:"tutorials/addressTags",title:"\ud83c\udff7\ufe0f Addresses Tags",description:'To make signing requests even more readable, you can "tag" addresses ahead of time. After that, any transaction requests referencing the tagged address will display your human-readable name instead of the raw address string. Tagging is done using what we call the "KV" API, which stands for key-value associations. You may add any mapping where the key and value are each up to 64 bytes.',source:"@site/docs/tutorials/addressTags.md",sourceDirName:"tutorials",slug:"/tutorials/addressTags",permalink:"/gridplus-sdk/tutorials/addressTags",draft:!1,editUrl:"https://github.com/gridplus/gridplus-sdk/docs/tutorials/addressTags.md",tags:[],version:"current",frontMatter:{},sidebar:"sidebar",previous:{title:"\ud83d\udcdc Calldata Decoding",permalink:"/gridplus-sdk/tutorials/calldataDecoding"},next:{title:"\ud83d\udda5\ufe0f ETH Staking Keys",permalink:"/gridplus-sdk/tutorials/ethDeposits"}},c={},u=[{value:"Example",id:"example",level:2}],p={toc:u};function g(e){var t=e.components,n=(0,r.Z)(e,i);return(0,s.kt)("wrapper",(0,a.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,s.kt)("h1",{id:"\ufe0f-addresses-tags"},"\ud83c\udff7\ufe0f Addresses Tags"),(0,s.kt)("p",null,'To make signing requests even more readable, you can "tag" addresses ahead of time. After that, any transaction requests referencing the tagged address will display your human-readable name instead of the raw address string. Tagging is done using what we call the "KV" API, which stands for key-value associations. You may add any mapping where the ',(0,s.kt)("strong",{parentName:"p"},"key")," and ",(0,s.kt)("strong",{parentName:"p"},"value")," are each ",(0,s.kt)("strong",{parentName:"p"},"up to 64 bytes"),"."),(0,s.kt)("admonition",{type:"info"},(0,s.kt)("p",{parentName:"admonition"},"Address tags are rendered on the Lattice screen anywhere an address might be rendered, including inside EIP712 requests and decoded transaction calldata!")),(0,s.kt)("p",null,"There are three methods used to manage tags:"),(0,s.kt)("ul",null,(0,s.kt)("li",{parentName:"ul"},(0,s.kt)("a",{parentName:"li",href:"../api/classes/client.Client#addkvrecords"},(0,s.kt)("inlineCode",{parentName:"a"},"addKvRecords")),": Add a set of address tags"),(0,s.kt)("li",{parentName:"ul"},(0,s.kt)("a",{parentName:"li",href:"../api/classes/client.Client#getkvrecords"},(0,s.kt)("inlineCode",{parentName:"a"},"getKvRecords")),": Fetch ",(0,s.kt)("inlineCode",{parentName:"li"},"n")," tags, starting at index ",(0,s.kt)("inlineCode",{parentName:"li"},"start")),(0,s.kt)("li",{parentName:"ul"},(0,s.kt)("a",{parentName:"li",href:"../api/classes/client.Client#removekvrecords"},(0,s.kt)("inlineCode",{parentName:"a"},"removeKvRecords")),": Remove a set of tags based on the passed ",(0,s.kt)("inlineCode",{parentName:"li"},"id"),"s")),(0,s.kt)("h2",{id:"example"},"Example"),(0,s.kt)("p",null,"The following code snippet and accompanying comments should show you how to manage address tags. We will be replacing an address tag if it exists on the Lattice already, or adding a new tag if an existing one does not exist:"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-ts"},"import { Client, Constants, Utils } from 'gridplus-sdk';\nimport { question } from 'readline-sync';\nconst deviceID = 'XXXXXX';\n\n// Set up your client and connect to the Lattice\nconst client = new Client({ name: 'ETH Depositooor' });\nconst isPaired = await client.connect(deviceID);\nif (!isPaired) {\n  const secret = await question('Enter pairing secret: ');\n  await client.pair(secret);\n}\n\n// Fetch 10 tags per request (max=10)\nconst nPerReq = 10;\n\n// Reference to the address that will be used in this example\nconst uniswapRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';\n\n// The new tag we want to add\n// NOTE: Emoji-based tags are not currently supported, sry \ud83d\ude14\nconst newTag = 'New Uniswap Router Tag';\n\n// Find out how many tags are stored on the target Lattice by passing\n// an empty struct as the options.\nconst existingTags = await client.getKvRecords({});\n\n// Loop through all saved tags and search for a possible match to the address\n// we want to re-tag here.\nfor (let reqIdx = 0; reqIdx < Math.floor(existingTags.total / nPerReq); reqIdx++) {\n  // Fetch all the tags in sets of `nPerReq`\n  const tags = client.getKvRecords({ n: nPerReq, start: reqIdx * nPerReq });\n  // Determine if we have found our tag\n  for (let i = 0; i < tags.length; i++) {\n    if (tags[i][uniswapRouter] !== undefined) {\n      // We have a tag saved - delete it by id\n      await client.removeKvRecords({ ids: [ tags[0].id ]});\n      // This probs wouldn't work in a JS/TS script like this but you get the idea\n      break;\n    }\n  }\n}\n\n// We can now be sure there is no tag for our address in question.\n// Add the new tag!\nconst newTags = [{\n  [uniswapRouter]: newTag,\n}]\nawait client.addKvRecords({ records: newTags });\n")))}g.isMDXComponent=!0}}]);