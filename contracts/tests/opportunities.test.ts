import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JavaScript shared with the browser
import { visibleOpportunities } from '../src/opportunities.js';
const items=[{id:'one',title:'Assessment',agency:'Agency',naics:'541519',analysis:{recommendation:'pass'}},{id:'two',title:'Training',agency:'Agency',naics:'541519'}];
test('a saved pass leaves the active inbox but remains available to reopen',()=>{
 const decisions={one:{status:'pass'}};
 assert.deepEqual(visibleOpportunities(items,decisions).map((n:{id:string})=>n.id),['two']);
 assert.deepEqual(visibleOpportunities(items,decisions,{filter:'pass'}).map((n:{id:string})=>n.id),['one']);
 assert.equal(visibleOpportunities(items,decisions,{filter:'all'}).length,2);
 assert.equal(visibleOpportunities(items,decisions,{filter:'review'}).length,1);
 decisions.one.status='inbox';
 assert.equal(visibleOpportunities(items,decisions).length,2);
});
test('AI recommendations do not archive opportunities without a saved human decision',()=>{
 assert.equal(visibleOpportunities(items,{}).length,2);
 assert.deepEqual(visibleOpportunities(items,{one:{status:'pass'},two:{status:'pursue'}},{tab:'pipeline'}).map((n:{id:string})=>n.id),['two']);
});
