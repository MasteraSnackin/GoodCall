import { build } from 'vite';
import { gzipSync } from 'node:zlib';

// Vite uses the existing project config. write:false leaves the live dist directory untouched.
const result = await build({ logLevel: 'silent', build: { write: false } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const chunks = outputs.filter(item => item.type === 'chunk').map(chunk => {
  const groups = new Map();
  for (const [id, item] of Object.entries(chunk.modules)) {
    const group = id.includes('/node_modules/')
      ? id.split('/node_modules/').at(-1).split('/').slice(0, id.split('/node_modules/').at(-1).startsWith('@') ? 2 : 1).join('/')
      : 'application';
    groups.set(group, (groups.get(group) ?? 0) + item.renderedLength);
  }
  return { file: chunk.fileName, isEntry: chunk.isEntry, imports: chunk.imports, dynamicImports: chunk.dynamicImports, bytes: Buffer.byteLength(chunk.code), gzipBytes: gzipSync(chunk.code).length, renderedModuleBytes: [...groups].map(([group, bytes]) => ({ group, bytes })).sort((a, b) => b.bytes - a.bytes) };
});
console.log(JSON.stringify({ timestamp: new Date().toISOString(), note: 'Production bundle generated in memory. Module renderedLength attribution is before final chunk minification; do not equate it to a package share of final gzip bytes. No transfer, parse, hydration or device timing measured.', chunks }, null, 2));
