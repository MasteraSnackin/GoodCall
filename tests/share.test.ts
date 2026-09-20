import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeAdvice,decodeAdvice} from '../src/lib/share';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,toPublishedAdvice} from '../src/lib/engine';
function advice(){const w=createWorkspace();return toPublishedAdvice({...draftAnswer(w.questions[3],w.products),status:'published'},w);}
test('share snapshot roundtrips Unicode and excludes workspace data',()=>{const a={...advice(),title:'Maya’s £38 choice — crème'};assert.deepEqual(decodeAdvice(encodeAdvice(a)),a);assert.equal(JSON.stringify(a).includes('@sarah'),false);});
test('malformed, oversized and invalid share payloads fail closed',()=>{assert.equal(decodeAdvice('???'),null);assert.equal(decodeAdvice('x'.repeat(23000)),null);assert.equal(decodeAdvice(btoa('{"title":"hello"}')),null);assert.throws(()=>encodeAdvice({...advice(),products:[{name:'Fake',price:-2,note:'x'}]}));});
test('decision snapshots are validated and older links remain readable',()=>{
 const current=advice();assert.ok(current.decision);assert.deepEqual(decodeAdvice(encodeAdvice(current))?.decision,current.decision);
 const legacy={...current};delete legacy.decision;assert.deepEqual(decodeAdvice(encodeAdvice(legacy)),legacy);
 for(const decision of [{...current.decision!,verdict:'Buy now'},{...current.decision!,suits:''},{...current.decision!,unknowns:'x'.repeat(801)}])assert.throws(()=>encodeAdvice({...current,decision:decision as typeof current.decision}));
});
