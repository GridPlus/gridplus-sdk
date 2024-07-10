"use strict";(self.webpackChunkgridplus_sdk_docs=self.webpackChunkgridplus_sdk_docs||[]).push([[745],{1755:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>i,contentTitle:()=>d,default:()=>o,frontMatter:()=>r,metadata:()=>c,toc:()=>h});var l=s(4848),n=s(8453);const r={},d="util",c={id:"reference/util",title:"util",description:"fetchCalldataDecoder()",source:"@site/docs/reference/util.md",sourceDirName:"reference",slug:"/reference/util",permalink:"/gridplus-sdk/reference/util",draft:!1,unlisted:!1,editUrl:"https://github.com/gridplus/gridplus-sdk/docs/reference/util.md",tags:[],version:"current",frontMatter:{},sidebar:"sidebar",previous:{title:"constants",permalink:"/gridplus-sdk/reference/constants"}},i={},h=[{value:"fetchCalldataDecoder()",id:"fetchcalldatadecoder",level:2},{value:"Parameters",id:"parameters",level:3},{value:"Returns",id:"returns",level:3},{value:"Source",id:"source",level:3},{value:"generateAppSecret()",id:"generateappsecret",level:2},{value:"Parameters",id:"parameters-1",level:3},{value:"Returns",id:"returns-1",level:3},{value:"Source",id:"source-1",level:3},{value:"getV()",id:"getv",level:2},{value:"Parameters",id:"parameters-2",level:3},{value:"Returns",id:"returns-2",level:3},{value:"Source",id:"source-2",level:3},{value:"selectDefFrom4byteABI()",id:"selectdeffrom4byteabi",level:2},{value:"Parameters",id:"parameters-3",level:3},{value:"Returns",id:"returns-3",level:3},{value:"Source",id:"source-3",level:3}];function x(e){const t={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",hr:"hr",li:"li",ol:"ol",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,n.R)(),...e.components};return(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(t.h1,{id:"util",children:"util"}),"\n",(0,l.jsx)(t.h2,{id:"fetchcalldatadecoder",children:"fetchCalldataDecoder()"}),"\n",(0,l.jsxs)(t.blockquote,{children:["\n",(0,l.jsxs)(t.p,{children:[(0,l.jsx)(t.strong,{children:"fetchCalldataDecoder"}),"(",(0,l.jsx)(t.code,{children:"_data"}),": ",(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Uint8Array"}),", ",(0,l.jsx)(t.code,{children:"to"}),": ",(0,l.jsx)(t.code,{children:"string"}),", ",(0,l.jsx)(t.code,{children:"_chainId"}),": ",(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"number"}),", ",(0,l.jsx)(t.code,{children:"recurse"}),": ",(0,l.jsx)(t.code,{children:"boolean"}),"): ",(0,l.jsx)(t.code,{children:"Promise"}),"<{",(0,l.jsx)(t.code,{children:'"abi"'}),": ",(0,l.jsx)(t.code,{children:"any"}),";",(0,l.jsx)(t.code,{children:'"def"'}),": ",(0,l.jsx)(t.code,{children:"Buffer"}),"; }>"]}),"\n"]}),"\n",(0,l.jsxs)(t.p,{children:["Fetches calldata from a remote scanner based on the transaction's ",(0,l.jsx)(t.code,{children:"chainId"})]}),"\n",(0,l.jsx)(t.h3,{id:"parameters",children:"Parameters"}),"\n",(0,l.jsxs)(t.table,{children:[(0,l.jsx)(t.thead,{children:(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Parameter"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Default value"})]})}),(0,l.jsxs)(t.tbody,{children:[(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"_data"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Uint8Array"})]}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"undefined"})})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"to"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"string"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"undefined"})})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"_chainId"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"number"})]}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"undefined"})})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"recurse"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"boolean"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"true"})})]})]})]}),"\n",(0,l.jsx)(t.h3,{id:"returns",children:"Returns"}),"\n",(0,l.jsxs)(t.p,{children:[(0,l.jsx)(t.code,{children:"Promise"}),"<{",(0,l.jsx)(t.code,{children:'"abi"'}),": ",(0,l.jsx)(t.code,{children:"any"}),";",(0,l.jsx)(t.code,{children:'"def"'}),": ",(0,l.jsx)(t.code,{children:"Buffer"}),"; }>"]}),"\n",(0,l.jsxs)(t.table,{children:[(0,l.jsx)(t.thead,{children:(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Member"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Value"})]})}),(0,l.jsxs)(t.tbody,{children:[(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"abi"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"any"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"-"})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"def"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"Buffer"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"..."})]})]})]}),"\n",(0,l.jsx)(t.h3,{id:"source",children:"Source"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.a,{href:"https://github.com/GridPlus/gridplus-sdk/blob/c012d317f562432cecf6de52536c5f6286c2e51b/src/util.ts#L582",children:"util.ts:582"})}),"\n",(0,l.jsx)(t.hr,{}),"\n",(0,l.jsx)(t.h2,{id:"generateappsecret",children:"generateAppSecret()"}),"\n",(0,l.jsxs)(t.blockquote,{children:["\n",(0,l.jsxs)(t.p,{children:[(0,l.jsx)(t.strong,{children:"generateAppSecret"}),"(",(0,l.jsx)(t.code,{children:"deviceId"}),": ",(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"}),", ",(0,l.jsx)(t.code,{children:"password"}),": ",(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"}),", ",(0,l.jsx)(t.code,{children:"appName"}),": ",(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"}),"): ",(0,l.jsx)(t.code,{children:"Buffer"})]}),"\n"]}),"\n",(0,l.jsx)(t.p,{children:"Generates an application secret for use in maintaining connection to device."}),"\n",(0,l.jsx)(t.h3,{id:"parameters-1",children:"Parameters"}),"\n",(0,l.jsxs)(t.table,{children:[(0,l.jsx)(t.thead,{children:(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Parameter"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,l.jsxs)(t.tbody,{children:[(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"deviceId"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"})]}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"The device ID of the device you want to generate a token for."})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"password"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"})]}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"The password entered when connecting to the device."})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"appName"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"string"})," | ",(0,l.jsx)(t.code,{children:"Buffer"})]}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"The name of the application."})]})]})]}),"\n",(0,l.jsx)(t.h3,{id:"returns-1",children:"Returns"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.code,{children:"Buffer"})}),"\n",(0,l.jsx)(t.p,{children:"an application secret as a Buffer"}),"\n",(0,l.jsx)(t.h3,{id:"source-1",children:"Source"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.a,{href:"https://github.com/GridPlus/gridplus-sdk/blob/c012d317f562432cecf6de52536c5f6286c2e51b/src/util.ts#L654",children:"util.ts:654"})}),"\n",(0,l.jsx)(t.hr,{}),"\n",(0,l.jsx)(t.h2,{id:"getv",children:"getV()"}),"\n",(0,l.jsxs)(t.blockquote,{children:["\n",(0,l.jsxs)(t.p,{children:[(0,l.jsx)(t.strong,{children:"getV"}),"(",(0,l.jsx)(t.code,{children:"tx"}),": ",(0,l.jsx)(t.code,{children:"any"}),", ",(0,l.jsx)(t.code,{children:"resp"}),": ",(0,l.jsx)(t.code,{children:"any"}),"): ",(0,l.jsx)(t.code,{children:"any"})]}),"\n"]}),"\n",(0,l.jsxs)(t.p,{children:["Generic signing does not return a ",(0,l.jsx)(t.code,{children:"v"})," value like legacy ETH signing requests did.\nGet the ",(0,l.jsx)(t.code,{children:"v"})," component of the signature as well as an ",(0,l.jsx)(t.code,{children:"initV"}),"\nparameter, which is what you need to use to re-create an ",(0,l.jsx)(t.code,{children:"@ethereumjs/tx"}),"\nobject. There is a lot of tech debt in ",(0,l.jsx)(t.code,{children:"@ethereumjs/tx"})," which also\ninherits the tech debt of ethereumjs-util."]}),"\n",(0,l.jsxs)(t.ol,{children:["\n",(0,l.jsxs)(t.li,{children:["The legacy ",(0,l.jsx)(t.code,{children:"Transaction"})," type can call ",(0,l.jsx)(t.code,{children:"_processSignature"})," with the regular\n",(0,l.jsx)(t.code,{children:"v"})," value."]}),"\n",(0,l.jsxs)(t.li,{children:["Newer transaction types such as ",(0,l.jsx)(t.code,{children:"FeeMarketEIP1559Transaction"})," will subtract\n27 from the ",(0,l.jsx)(t.code,{children:"v"})," that gets passed in, so we need to add ",(0,l.jsx)(t.code,{children:"27"})," to create ",(0,l.jsx)(t.code,{children:"initV"})]}),"\n"]}),"\n",(0,l.jsx)(t.h3,{id:"parameters-2",children:"Parameters"}),"\n",(0,l.jsxs)(t.table,{children:[(0,l.jsx)(t.thead,{children:(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Parameter"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,l.jsxs)(t.tbody,{children:[(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"tx"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"any"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"An @ethereumjs/tx Transaction object or Buffer (serialized tx)"})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"resp"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"any"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:"response from Lattice. Can be either legacy or generic signing variety"})]})]})]}),"\n",(0,l.jsx)(t.h3,{id:"returns-2",children:"Returns"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.code,{children:"any"})}),"\n",(0,l.jsxs)(t.p,{children:["bn.js BN object containing the ",(0,l.jsx)(t.code,{children:"v"})," param"]}),"\n",(0,l.jsx)(t.h3,{id:"source-2",children:"Source"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.a,{href:"https://github.com/GridPlus/gridplus-sdk/blob/c012d317f562432cecf6de52536c5f6286c2e51b/src/util.ts#L689",children:"util.ts:689"})}),"\n",(0,l.jsx)(t.hr,{}),"\n",(0,l.jsx)(t.h2,{id:"selectdeffrom4byteabi",children:"selectDefFrom4byteABI()"}),"\n",(0,l.jsxs)(t.blockquote,{children:["\n",(0,l.jsxs)(t.p,{children:[(0,l.jsx)(t.strong,{children:"selectDefFrom4byteABI"}),"(",(0,l.jsx)(t.code,{children:"abiData"}),": ",(0,l.jsx)(t.code,{children:"any"}),"[], ",(0,l.jsx)(t.code,{children:"selector"}),": ",(0,l.jsx)(t.code,{children:"string"}),"): ",(0,l.jsx)(t.code,{children:"any"})]}),"\n"]}),"\n",(0,l.jsx)(t.p,{children:"Takes a list of ABI data objects and a selector, and returns the earliest ABI data object that\nmatches the selector."}),"\n",(0,l.jsx)(t.h3,{id:"parameters-3",children:"Parameters"}),"\n",(0,l.jsxs)(t.table,{children:[(0,l.jsx)(t.thead,{children:(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Parameter"}),(0,l.jsx)(t.th,{style:{textAlign:"left"},children:"Type"})]})}),(0,l.jsxs)(t.tbody,{children:[(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"abiData"})}),(0,l.jsxs)(t.td,{style:{textAlign:"left"},children:[(0,l.jsx)(t.code,{children:"any"}),"[]"]})]}),(0,l.jsxs)(t.tr,{children:[(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"selector"})}),(0,l.jsx)(t.td,{style:{textAlign:"left"},children:(0,l.jsx)(t.code,{children:"string"})})]})]})]}),"\n",(0,l.jsx)(t.h3,{id:"returns-3",children:"Returns"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.code,{children:"any"})}),"\n",(0,l.jsx)(t.h3,{id:"source-3",children:"Source"}),"\n",(0,l.jsx)(t.p,{children:(0,l.jsx)(t.a,{href:"https://github.com/GridPlus/gridplus-sdk/blob/c012d317f562432cecf6de52536c5f6286c2e51b/src/util.ts#L362",children:"util.ts:362"})})]})}function o(e={}){const{wrapper:t}={...(0,n.R)(),...e.components};return t?(0,l.jsx)(t,{...e,children:(0,l.jsx)(x,{...e})}):x(e)}},8453:(e,t,s)=>{s.d(t,{R:()=>d,x:()=>c});var l=s(6540);const n={},r=l.createContext(n);function d(e){const t=l.useContext(r);return l.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:d(e.components),l.createElement(r.Provider,{value:t},e.children)}}}]);