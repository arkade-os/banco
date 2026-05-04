// Writes per-bundle `package.json` markers so Node interprets each bundle
// with the correct module type, regardless of the root package's `"type"`.
//
// Without these, a consumer doing `require('@arkade-os/banco')` resolves to
// `dist/cjs/index.js` but Node treats it as ESM (because of the root
// `"type": "module"`) and crashes on `Object.defineProperty(exports, ...)`.
import { writeFileSync } from 'node:fs'

writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n')
writeFileSync('dist/esm/package.json', '{"type":"module"}\n')
