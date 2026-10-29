export function visibleOpportunities(items, decisions, {tab='inbox', query='', filter='active'}={}) {
 return items.filter(n=>{
  const status=decisions[n.id]?.status||'inbox';
  if(tab==='pipeline'&&!['pursue','partner','monitor'].includes(status))return false;
  if(query&&!`${n.title} ${n.agency} ${n.naics}`.toLowerCase().includes(query.toLowerCase()))return false;
  if(filter==='active')return status!=='pass';
  if(filter==='all')return true;
  if(filter==='changed')return Boolean(n.changed);
  if(filter==='review')return status==='inbox'&&(!n.analysis||n.analysis.recommendation==='review');
  return status===filter;
 });
}
