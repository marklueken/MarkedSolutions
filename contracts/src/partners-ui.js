const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blank={name:'',company:'',email:'',skills:'',certifications:'',experience:'',location:'',availability:'unknown',availabilityNotes:'',rateNotes:'',clearance:'',notes:'',resumeText:'',includeInAnalysis:true,archived:false};
let demoPartners=[];
async function request(action,body){
 const r=await fetch(`/api/partners/${action}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 let data;try{data=await r.json();}catch{throw Error('Partner service is unavailable. Try again.');}if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
export async function partnersPage({root,openModal,toast,demo=false}){
 root.innerHTML='<div class="page-heading"><div><span class="eyebrow">FLEXIBLE DELIVERY CAPACITY</span><h1>Partner directory</h1><p>Build your pool of independent subcontractors and match their evidence to opportunities.</p></div><div class="actions"><button class="secondary" id="partner-add">Add partner</button></div></div><div class="panel"><div class="partner-toolbar"><label>Search partners<input id="partner-search" placeholder="Name, skill, certification, or location"></label><label>View<select id="partner-view"><option value="active">Active partners</option><option value="archived">Archived partners</option><option value="all">All partners</option></select></label></div><p class="small muted">Included profiles and resume text are used in new AI analyses. Availability and credentials still need confirmation. Contact details and internal notes are excluded from AI requests.</p><div id="partner-results" role="status">Loading partners…</div></div>';
 let pool=[];
 const results=root.querySelector('#partner-results');
 const draw=()=>{
  const query=root.querySelector('#partner-search').value.toLowerCase(),view=root.querySelector('#partner-view').value;
  const items=pool.filter(p=>(view==='all'||(view==='archived'?p.archived:!p.archived))&&[p.name,p.company,p.skills,p.certifications,p.location].join(' ').toLowerCase().includes(query));
  results.innerHTML=items.length?`<div class="partner-list">${items.map(p=>`<button class="partner-card" data-partner="${esc(p.id)}"><h2>${esc(p.name)}</h2><p>${esc(p.company||'Independent subcontractor')}</p><span class="badge ${p.availability==='available'?'pursue':'review'}">${esc(p.availability)}</span> <span class="small muted">${p.archived?'Archived':p.includeInAnalysis?'Included in analysis':'Excluded from analysis'}</span><p>${esc(p.skills||'Skills not documented yet')}</p><span class="small muted">${esc(p.location||'Location not documented')}${p.resumeName?' · Resume saved':''}</span></button>`).join('')}</div>`:'<div class="empty"><h2>No partners in this view</h2><p>Email a resume to partners@marked.solutions and approve it in Resume intake, or add a partner here.</p></div>';
  results.querySelectorAll('[data-partner]').forEach(b=>b.onclick=async()=>{try{const p=demo?pool.find(p=>p.id===b.dataset.partner):(await request(`detail?id=${encodeURIComponent(b.dataset.partner)}`)).partner;edit(p);}catch(e){toast(e.message,true);}});
 };
 const refresh=async()=>{pool=demo?demoPartners:(await request('list')).partners;draw();};
 const edit=(record)=>{
  const p={...blank,...record};let resumeFile=null,extracting=false;
  openModal(`<span class="eyebrow">INDEPENDENT SUBCONTRACTOR</span><h1>${record?'Edit partner':'Add partner'}</h1><p class="muted">Store skills and evidence for potential delivery teams. This does not commit the partner to a contract.</p><form id="partner-form"><div class="form-row"><label>Name<input name="name" required minlength="2" maxlength="150" value="${esc(p.name)}"></label><label>Business / company<input name="company" maxlength="200" value="${esc(p.company)}"></label></div><div class="form-row"><label>Email<input name="email" type="email" value="${esc(p.email)}"></label><label>Location / remote / travel<input name="location" maxlength="300" value="${esc(p.location)}"></label></div><label>Skills and specialties<textarea name="skills" maxlength="6000" rows="3" placeholder="Web app testing, cloud security, compliance…">${esc(p.skills)}</textarea></label><label>Certifications and evidence<textarea name="certifications" maxlength="4000" rows="2" placeholder="Credential, issuer, expiry, and verification notes">${esc(p.certifications)}</textarea></label><label>Relevant experience<textarea name="experience" maxlength="8000" rows="3">${esc(p.experience)}</textarea></label><label>Personal clearance and verification notes<input name="clearance" maxlength="1000" value="${esc(p.clearance)}" placeholder="Do not treat personal clearance as company facility clearance"></label><div class="form-row"><label>Availability<select name="availability">${['unknown','available','limited','unavailable'].map(v=>`<option value="${v}" ${p.availability===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label><label>Rate / pricing notes<input name="rateNotes" maxlength="1000" value="${esc(p.rateNotes)}" placeholder="e.g. $150/hour, estimated; confirm per project"></label></div><label>Availability details<textarea name="availabilityNotes" maxlength="2000" rows="2" placeholder="Hours, start date, other commitments">${esc(p.availabilityNotes)}</textarea></label><label>Internal notes (excluded from AI)<textarea name="notes" maxlength="4000" rows="2">${esc(p.notes)}</textarea></label><label>Resume file — PDF or text, up to 2 MB<input id="partner-file" type="file" accept=".pdf,.txt,.md"></label><p id="resume-status" class="small muted" role="status">${p.resumeName?`Saved file: ${esc(p.resumeName)}`:'Original files are stored privately. PDF text is extracted with page references; scanned PDFs may need OCR.'}</p>${p.resumeName&&!demo?`<a class="secondary" href="/api/partners/resume?id=${encodeURIComponent(p.id)}">Download saved resume</a>`:''}<label>Resume text for analysis<textarea name="resumeText" maxlength="60000" rows="7" placeholder="Extracted text or paste resume text here">${esc(p.resumeText)}</textarea></label><label class="checkbox"><input type="checkbox" name="includeInAnalysis" ${p.includeInAnalysis?'checked':''}>Include this partner's profile and resume text in opportunity analysis</label><label class="checkbox"><input type="checkbox" name="archived" ${p.archived?'checked':''}>Archive partner (retain the record and exclude from analysis)</label><p class="small muted">Upload resumes you have permission to store and analyze. Keep unrelated personal information out of the analysis text.</p><button class="primary full" type="submit">Save partner</button><p id="partner-error" class="form-error" role="alert" hidden></p></form>`,true);
  const form=document.querySelector('#partner-form'),error=form.querySelector('#partner-error'),button=form.querySelector('button[type=submit]');
  form.querySelector('#partner-file').onchange=async e=>{
   const f=e.target.files[0];resumeFile=null;if(!f)return;
   const status=form.querySelector('#resume-status');
   if(f.size>2*1024*1024){error.textContent='Choose a resume no larger than 2 MB.';error.hidden=false;button.disabled=true;return;}
   extracting=true;button.disabled=true;status.textContent='Extracting resume text…';error.hidden=true;
   try{
    const bytes=new Uint8Array(await f.arrayBuffer());let text='';const isPdf=f.name.toLowerCase().endsWith('.pdf');
    if(isPdf){const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;const doc=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;try{if(doc.numPages>50)throw Error('Use a resume of 50 pages or fewer.');for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();text+=`\n[Page ${i}]\n`+content.items.map(x=>x.str||'').join(' ');if(text.length>60000)throw Error('Resume text exceeds 60,000 characters.');}}finally{await doc.destroy();}}
    else{if(!/\.(txt|md)$/i.test(f.name))throw Error('Choose a PDF or text resume.');text=new TextDecoder().decode(bytes);}
    if(text.length>60000)throw Error('Resume text exceeds 60,000 characters.');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    resumeFile={name:f.name,type:isPdf?'application/pdf':'text/plain',data:btoa(binary)};
    form.elements.resumeText.value=text.trim();status.textContent=`${f.name}: ${text.length.toLocaleString()} characters extracted. Review the text before saving.${text.trim().length<30?' Scanned PDF: paste OCR text for meaningful analysis.':''}`;
   }catch(e){error.textContent=e.message;error.hidden=false;status.textContent='File was not loaded. Choose another file or paste resume text.';}
   finally{extracting=false;button.disabled=false;}
  };
  form.onsubmit=async e=>{
   e.preventDefault();if(extracting||button.disabled)return;button.disabled=true;button.textContent='Saving…';error.hidden=true;
   const f=new FormData(form),value={...Object.fromEntries(f),id:p.id,includeInAnalysis:f.has('includeInAnalysis'),archived:f.has('archived')};
   if(resumeFile)value.resumeFile=resumeFile;
   try{
    if(demo){const next={...value,id:value.id||crypto.randomUUID(),resumeName:resumeFile?.name||p.resumeName};demoPartners=[...demoPartners.filter(p=>p.id!==next.id),next];}
    else await request('save',value);
    document.querySelector('#modal').close();await refresh();toast(demo?'Example partner saved for this session.':'Partner saved. Reanalyze an opportunity to use the updated pool.');
   }catch(e){error.textContent=e.message;error.hidden=false;button.disabled=false;button.textContent='Save partner';}
  };
 };
 root.querySelector('#partner-add').onclick=()=>edit();root.querySelector('#partner-search').oninput=draw;root.querySelector('#partner-view').onchange=draw;
 try{await refresh();}catch(e){results.textContent=e.message;}
}
