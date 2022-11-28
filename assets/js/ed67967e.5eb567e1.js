"use strict";(self.webpackChunkgridplus_sdk_docs=self.webpackChunkgridplus_sdk_docs||[]).push([[7082],{3905:function(e,t,a){a.d(t,{Zo:function(){return m},kt:function(){return u}});var n=a(7294);function r(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function i(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function l(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?i(Object(a),!0).forEach((function(t){r(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):i(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function d(e,t){if(null==e)return{};var a,n,r=function(e,t){if(null==e)return{};var a,n,r={},i=Object.keys(e);for(n=0;n<i.length;n++)a=i[n],t.indexOf(a)>=0||(r[a]=e[a]);return r}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)a=i[n],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(r[a]=e[a])}return r}var s=n.createContext({}),p=function(e){var t=n.useContext(s),a=t;return e&&(a="function"==typeof e?e(t):l(l({},t),e)),a},m=function(e){var t=p(e.components);return n.createElement(s.Provider,{value:t},e.children)},k={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},o=n.forwardRef((function(e,t){var a=e.components,r=e.mdxType,i=e.originalType,s=e.parentName,m=d(e,["components","mdxType","originalType","parentName"]),o=p(a),u=r,c=o["".concat(s,".").concat(u)]||o[u]||k[u]||i;return a?n.createElement(c,l(l({ref:t},m),{},{components:a})):n.createElement(c,l({ref:t},m))}));function u(e,t){var a=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var i=a.length,l=new Array(i);l[0]=o;var d={};for(var s in t)hasOwnProperty.call(t,s)&&(d[s]=t[s]);d.originalType=e,d.mdxType="string"==typeof e?e:r,l[1]=d;for(var p=2;p<i;p++)l[p]=a[p];return n.createElement.apply(null,l)}return n.createElement.apply(null,a)}o.displayName="MDXCreateElement"},2650:function(e,t,a){a.r(t),a.d(t,{assets:function(){return m},contentTitle:function(){return s},default:function(){return u},frontMatter:function(){return d},metadata:function(){return p},toc:function(){return k}});var n=a(7462),r=a(3366),i=(a(7294),a(3905)),l=["components"],d={id:"client.Client",title:"Class: Client",custom_edit_url:null},s=void 0,p={unversionedId:"api/classes/client.Client",id:"api/classes/client.Client",title:"Class: Client",description:"client.Client",source:"@site/docs/api/classes/client.Client.md",sourceDirName:"api/classes",slug:"/api/classes/client.Client",permalink:"/gridplus-sdk/api/classes/client.Client",draft:!1,editUrl:null,tags:[],version:"current",frontMatter:{id:"client.Client",title:"Class: Client",custom_edit_url:null},sidebar:"sidebar",previous:{title:"\ud83e\uddea Testing",permalink:"/gridplus-sdk/testing"},next:{title:"Module: util",permalink:"/gridplus-sdk/api/modules/util"}},m={},k=[{value:"Constructors",id:"constructors",level:2},{value:"constructor",id:"constructor",level:3},{value:"Parameters",id:"parameters",level:4},{value:"Defined in",id:"defined-in",level:4},{value:"Properties",id:"properties",level:2},{value:"activeWallets",id:"activewallets",level:3},{value:"Defined in",id:"defined-in-1",level:4},{value:"baseUrl",id:"baseurl",level:3},{value:"Defined in",id:"defined-in-2",level:4},{value:"isPaired",id:"ispaired",level:3},{value:"Defined in",id:"defined-in-3",level:4},{value:"timeout",id:"timeout",level:3},{value:"Defined in",id:"defined-in-4",level:4},{value:"Lattice Methods",id:"lattice-methods",level:2},{value:"addKvRecords",id:"addkvrecords",level:3},{value:"Parameters",id:"parameters-1",level:4},{value:"Returns",id:"returns",level:4},{value:"Defined in",id:"defined-in-5",level:4},{value:"connect",id:"connect",level:3},{value:"Parameters",id:"parameters-2",level:4},{value:"Returns",id:"returns-1",level:4},{value:"Defined in",id:"defined-in-6",level:4},{value:"fetchEncryptedData",id:"fetchencrypteddata",level:3},{value:"Parameters",id:"parameters-3",level:4},{value:"Returns",id:"returns-2",level:4},{value:"Defined in",id:"defined-in-7",level:4},{value:"getAddresses",id:"getaddresses",level:3},{value:"Parameters",id:"parameters-4",level:4},{value:"Returns",id:"returns-3",level:4},{value:"Defined in",id:"defined-in-8",level:4},{value:"getKvRecords",id:"getkvrecords",level:3},{value:"Parameters",id:"parameters-5",level:4},{value:"Returns",id:"returns-4",level:4},{value:"Defined in",id:"defined-in-9",level:4},{value:"pair",id:"pair",level:3},{value:"Parameters",id:"parameters-6",level:4},{value:"Returns",id:"returns-5",level:4},{value:"Defined in",id:"defined-in-10",level:4},{value:"removeKvRecords",id:"removekvrecords",level:3},{value:"Parameters",id:"parameters-7",level:4},{value:"Returns",id:"returns-6",level:4},{value:"Defined in",id:"defined-in-11",level:4},{value:"sign",id:"sign",level:3},{value:"Parameters",id:"parameters-8",level:4},{value:"Returns",id:"returns-7",level:4},{value:"Defined in",id:"defined-in-12",level:4},{value:"Other Methods",id:"other-methods",level:2},{value:"fetchActiveWallet",id:"fetchactivewallet",level:3},{value:"Returns",id:"returns-8",level:4},{value:"Defined in",id:"defined-in-13",level:4},{value:"getActiveWallet",id:"getactivewallet",level:3},{value:"Returns",id:"returns-9",level:4},{value:"Defined in",id:"defined-in-14",level:4},{value:"getAppName",id:"getappname",level:3},{value:"Returns",id:"returns-10",level:4},{value:"Defined in",id:"defined-in-15",level:4},{value:"hasActiveWallet",id:"hasactivewallet",level:3},{value:"Returns",id:"returns-11",level:4},{value:"Defined in",id:"defined-in-16",level:4}],o={toc:k};function u(e){var t=e.components,a=(0,r.Z)(e,l);return(0,i.kt)("wrapper",(0,n.Z)({},o,a,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/modules/client"},"client"),".Client"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Client")," is a class-based interface for managing a Lattice device."),(0,i.kt)("h2",{id:"constructors"},"Constructors"),(0,i.kt)("h3",{id:"constructor"},"constructor"),(0,i.kt)("p",null,"\u2022 ",(0,i.kt)("strong",{parentName:"p"},"new Client"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"params"),")"),(0,i.kt)("h4",{id:"parameters"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Description"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"Object")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Parameters are passed as an object.")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.baseUrl?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The base URL of the signing server.")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.name?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The name of the client.")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.privKey?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string")," ","|"," ",(0,i.kt)("inlineCode",{parentName:"td"},"Buffer")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The private key of the client.")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.retryCount?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"number")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Number of times to retry a request if it fails.")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.skipRetryOnWrongWallet?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"boolean")),(0,i.kt)("td",{parentName:"tr",align:"left"},"If true we will not retry if we get a wrong wallet error code")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.stateData?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string")),(0,i.kt)("td",{parentName:"tr",align:"left"},"User can pass in previous state data to rehydrate connected session")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params.timeout?")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"number")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The time to wait for a response before cancelling.")))),(0,i.kt)("h4",{id:"defined-in"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L55"},"src/client.ts:55")),(0,i.kt)("h2",{id:"properties"},"Properties"),(0,i.kt)("h3",{id:"activewallets"},"activeWallets"),(0,i.kt)("p",null,"\u2022 ",(0,i.kt)("strong",{parentName:"p"},"activeWallets"),": ",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.ActiveWallets"},(0,i.kt)("inlineCode",{parentName:"a"},"ActiveWallets"))),(0,i.kt)("p",null,"Information about the current wallet. Should be null unless we know a wallet is present"),(0,i.kt)("h4",{id:"defined-in-1"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L48"},"src/client.ts:48")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"baseurl"},"baseUrl"),(0,i.kt)("p",null,"\u2022 ",(0,i.kt)("strong",{parentName:"p"},"baseUrl"),": ",(0,i.kt)("inlineCode",{parentName:"p"},"string")),(0,i.kt)("p",null,"The base of the remote url to which the SDK sends requests."),(0,i.kt)("h4",{id:"defined-in-2"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L31"},"src/client.ts:31")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"ispaired"},"isPaired"),(0,i.kt)("p",null,"\u2022 ",(0,i.kt)("strong",{parentName:"p"},"isPaired"),": ",(0,i.kt)("inlineCode",{parentName:"p"},"boolean")),(0,i.kt)("p",null,"Is the Lattice paired with this Client."),(0,i.kt)("h4",{id:"defined-in-3"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L27"},"src/client.ts:27")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"timeout"},"timeout"),(0,i.kt)("p",null,"\u2022 ",(0,i.kt)("strong",{parentName:"p"},"timeout"),": ",(0,i.kt)("inlineCode",{parentName:"p"},"number")),(0,i.kt)("p",null,"The time to wait for a response before cancelling."),(0,i.kt)("h4",{id:"defined-in-4"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L29"},"src/client.ts:29")),(0,i.kt)("h2",{id:"lattice-methods"},"Lattice Methods"),(0,i.kt)("h3",{id:"addkvrecords"},"addKvRecords"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"addKvRecords"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"__namedParameters"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("p",null,"Takes in a set of key-value records and sends a request to add them to the Lattice."),(0,i.kt)("h4",{id:"parameters-1"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"__namedParameters")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_addKvRecords.AddKvRecordsRequestParams"},(0,i.kt)("inlineCode",{parentName:"a"},"AddKvRecordsRequestParams")))))),(0,i.kt)("h4",{id:"returns"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("h4",{id:"defined-in-5"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L176"},"src/client.ts:176")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"connect"},"connect"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"connect"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"deviceId"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"any"),">"),(0,i.kt)("p",null,"Attempt to contact a device based on its ",(0,i.kt)("inlineCode",{parentName:"p"},"deviceId"),". The response should include an ephemeral\npublic key, which is used to pair with the device in a later request."),(0,i.kt)("h4",{id:"parameters-2"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"deviceId")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string"))))),(0,i.kt)("h4",{id:"returns-1"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"any"),">"),(0,i.kt)("h4",{id:"defined-in-6"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L126"},"src/client.ts:126")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"fetchencrypteddata"},"fetchEncryptedData"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"fetchEncryptedData"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"params"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("p",null,"Fetch a record of encrypted data from the Lattice.\nMust specify a data type. Returns a Buffer containing\ndata formatted according to the specified type."),(0,i.kt)("h4",{id:"parameters-3"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"params")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_fetchEncData.FetchEncDataRequest"},(0,i.kt)("inlineCode",{parentName:"a"},"FetchEncDataRequest")))))),(0,i.kt)("h4",{id:"returns-2"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("h4",{id:"defined-in-7"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L213"},"src/client.ts:213")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"getaddresses"},"getAddresses"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"getAddresses"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"__namedParameters"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"string"),"[] ","|"," ",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),"[]",">"),(0,i.kt)("p",null,"Takes a starting path and a number to get the addresses associated with the active wallet."),(0,i.kt)("h4",{id:"parameters-4"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"__namedParameters")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_getAddresses.GetAddressesRequestParams"},(0,i.kt)("inlineCode",{parentName:"a"},"GetAddressesRequestParams")))))),(0,i.kt)("h4",{id:"returns-3"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"string"),"[] ","|"," ",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),"[]",">"),(0,i.kt)("h4",{id:"defined-in-8"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L144"},"src/client.ts:144")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"getkvrecords"},"getKvRecords"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"getKvRecords"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"__namedParameters"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_getKvRecords.GetKvRecordsData"},(0,i.kt)("inlineCode",{parentName:"a"},"GetKvRecordsData")),">"),(0,i.kt)("p",null,"Fetches a list of key-value records from the Lattice."),(0,i.kt)("h4",{id:"parameters-5"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"__namedParameters")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_getKvRecords.GetKvRecordsRequestParams"},(0,i.kt)("inlineCode",{parentName:"a"},"GetKvRecordsRequestParams")))))),(0,i.kt)("h4",{id:"returns-4"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_getKvRecords.GetKvRecordsData"},(0,i.kt)("inlineCode",{parentName:"a"},"GetKvRecordsData")),">"),(0,i.kt)("h4",{id:"defined-in-9"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L188"},"src/client.ts:188")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"pair"},"pair"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"pair"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"pairingSecret"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"any"),">"),(0,i.kt)("p",null,"If a pairing secret is provided, ",(0,i.kt)("inlineCode",{parentName:"p"},"pair")," uses it to sign a hash of the public key, name, and\npairing secret. It then sends the name and signature to the device. If no pairing secret is\nprovided, ",(0,i.kt)("inlineCode",{parentName:"p"},"pair")," sends a zero-length name buffer to the device."),(0,i.kt)("h4",{id:"parameters-6"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"pairingSecret")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"string"))))),(0,i.kt)("h4",{id:"returns-5"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"any"),">"),(0,i.kt)("h4",{id:"defined-in-10"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L136"},"src/client.ts:136")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"removekvrecords"},"removeKvRecords"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"removeKvRecords"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"__namedParameters"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("p",null,"Takes in an array of ids and sends a request to remove them from the Lattice."),(0,i.kt)("h4",{id:"parameters-7"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"__namedParameters")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_removeKvRecords.RemoveKvRecordsRequestParams"},(0,i.kt)("inlineCode",{parentName:"a"},"RemoveKvRecordsRequestParams")))))),(0,i.kt)("h4",{id:"returns-6"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("inlineCode",{parentName:"p"},"Buffer"),">"),(0,i.kt)("h4",{id:"defined-in-11"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L200"},"src/client.ts:200")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"sign"},"sign"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"sign"),"(",(0,i.kt)("inlineCode",{parentName:"p"},"__namedParameters"),"): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.SignData"},(0,i.kt)("inlineCode",{parentName:"a"},"SignData")),">"),(0,i.kt)("p",null,"Builds and sends a request for signing to the Lattice."),(0,i.kt)("h4",{id:"parameters-8"},"Parameters"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Name"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"__namedParameters")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/gridplus-sdk/api/interfaces/types_sign.SignRequestParams"},(0,i.kt)("inlineCode",{parentName:"a"},"SignRequestParams")))))),(0,i.kt)("h4",{id:"returns-7"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.SignData"},(0,i.kt)("inlineCode",{parentName:"a"},"SignData")),">"),(0,i.kt)("h4",{id:"defined-in-12"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L156"},"src/client.ts:156")),(0,i.kt)("hr",null),(0,i.kt)("h2",{id:"other-methods"},"Other Methods"),(0,i.kt)("h3",{id:"fetchactivewallet"},"fetchActiveWallet"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"fetchActiveWallet"),"(): ",(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.ActiveWallets"},(0,i.kt)("inlineCode",{parentName:"a"},"ActiveWallets")),">"),(0,i.kt)("p",null,"Fetch the active wallet in the Lattice."),(0,i.kt)("h4",{id:"returns-8"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"Promise"),"<",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.ActiveWallets"},(0,i.kt)("inlineCode",{parentName:"a"},"ActiveWallets")),">"),(0,i.kt)("h4",{id:"defined-in-13"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L168"},"src/client.ts:168")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"getactivewallet"},"getActiveWallet"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"getActiveWallet"),"(): ",(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.Wallet"},(0,i.kt)("inlineCode",{parentName:"a"},"Wallet"))),(0,i.kt)("p",null,"Get the active wallet"),(0,i.kt)("h4",{id:"returns-9"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"/gridplus-sdk/api/interfaces/types_client.Wallet"},(0,i.kt)("inlineCode",{parentName:"a"},"Wallet"))),(0,i.kt)("h4",{id:"defined-in-14"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L220"},"src/client.ts:220")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"getappname"},"getAppName"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"getAppName"),"(): ",(0,i.kt)("inlineCode",{parentName:"p"},"string")),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"getAppName")," returns the name of the application to which this device is currently paired."),(0,i.kt)("h4",{id:"returns-10"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"string")),(0,i.kt)("h4",{id:"defined-in-15"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L289"},"src/client.ts:289")),(0,i.kt)("hr",null),(0,i.kt)("h3",{id:"hasactivewallet"},"hasActiveWallet"),(0,i.kt)("p",null,"\u25b8 ",(0,i.kt)("strong",{parentName:"p"},"hasActiveWallet"),"(): ",(0,i.kt)("inlineCode",{parentName:"p"},"boolean")),(0,i.kt)("p",null,"Check if the user has an active wallet"),(0,i.kt)("h4",{id:"returns-11"},"Returns"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"boolean")),(0,i.kt)("h4",{id:"defined-in-16"},"Defined in"),(0,i.kt)("p",null,(0,i.kt)("a",{parentName:"p",href:"https://github.com/GridPlus/gridplus-sdk/blob/8494183/src/client.ts#L237"},"src/client.ts:237")))}u.isMDXComponent=!0}}]);