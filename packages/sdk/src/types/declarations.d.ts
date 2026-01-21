declare module 'aes-js'
declare module 'hash.js/lib/hash/sha'
declare module 'hash.js/lib/hash/ripemd.js' {
  export function ripemd160(): {
    update: (data: any) => any
    digest: (encoding?: any) => any
  }
}
declare module 'lodash/inRange.js' {
  const fn: (number: any, start?: any, end?: any) => boolean
  export default fn
}
declare module 'lodash/isInteger.js' {
  const fn: (value: any) => boolean
  export default fn
}
declare module 'lodash/isEmpty.js' {
  const fn: (value: any) => boolean
  export default fn
}

// Add more flexible typing to reduce strict type checking for complex modules
declare global {
  type NodeRequire = (id: string) => any
}
