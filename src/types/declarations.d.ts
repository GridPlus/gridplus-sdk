declare module 'aes-js';
declare module 'hash.js/lib/hash/sha';

// Add more flexible typing to reduce strict type checking for complex modules
declare global {
  interface NodeRequire {
    (id: string): any;
  }
}
