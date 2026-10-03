export const partnerColumns = ['name','email','company','location','skills','certifications','clearance','experience','availability','availability_notes','rate_notes','resume_text','notes'] as const;
export type PartnerInput = Record<typeof partnerColumns[number],string>;
export type Partner = PartnerInput & {id:string;updatedAt:string};
export function parsePartnerCSV(csv:string):PartnerInput[] {
 if(csv.length>450000)throw Error('CSV must be smaller than 450,000 characters.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 csv=csv.replace(/^\uFEFF/,'');
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(quoted){if(c==='"'){if(csv[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Unexpected quote in CSV.');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&csv[i+1]==='\n')i++;rows.push(row);row=[];}}
  else{if(closed)throw Error('Unexpected text after a quoted CSV field.');cell+=c;}
 }
 if(quoted)throw Error('A quoted CSV field is not closed.');
 if(cell||row.length||closed){row.push(cell);rows.push(row);}
 const headers=rows.shift()?.map(s=>s.trim().toLowerCase())||[];
 if(!headers.includes('name')||!headers.includes('email'))throw Error('CSV requires name and email columns.');
 if(new Set(headers).size!==headers.length||headers.some(h=>!partnerColumns.includes(h as any)))throw Error('Use the template column names, with no duplicate columns.');
 const result:PartnerInput[]=[],seen=new Set<string>();
 rows.forEach((r,index)=>{
  if(r.every(s=>!s.trim()))return;
  const line=index+2;
  if(r.length!==headers.length)throw Error(`Row ${line}: column count does not match the header.`);
  const p=Object.fromEntries(partnerColumns.map(h=>[h,''])) as PartnerInput;
  headers.forEach((h,i)=>p[h as keyof PartnerInput]=r[i].trim());p.email=p.email.toLowerCase();
  if(p.name.length<2||p.name.length>150)throw Error(`Row ${line}: provide a name (2–150 characters).`);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||p.email.length>254)throw Error(`Row ${line}: provide a valid email address.`);
  if(seen.has(p.email))throw Error(`Row ${line}: duplicate email ${p.email}.`);seen.add(p.email);
  const limits:Record<string,number>={name:150,email:254,company:200,location:300,skills:6000,certifications:4000,clearance:1000,experience:8000,availability:20,availability_notes:2000,rate_notes:1000,resume_text:50000,notes:4000};
  for(const key of partnerColumns){if(p[key].length>limits[key])throw Error(`Row ${line}: ${key} is too long.`);}
  if(p.availability&&!['unknown','available','limited','unavailable'].includes(p.availability.toLowerCase()))throw Error(`Row ${line}: availability must be unknown, available, limited, or unavailable.`);
  p.availability=p.availability.toLowerCase();
  result.push(p);
 });
 if(!result.length)throw Error('CSV contains no partners.');
 if(result.length>200)throw Error('Import up to 200 partners per file.');
 return result;
}
