'use strict';
const $ = id => document.getElementById(id);
const origin = 'https://onecompiler.com';
const iframe = $('compiler');
const supported = /\.(cpp|cc|cxx|c|h|hpp|hh|txt)$/i;
let items = []; // [{ name, path, code, file }]
let activePath = null;
let currentCode = ''; // blank page by default
let filename = 'tanpa_judul.cpp';
let ready = false;
let revision = 0;
let lastSent = null;
function message(str) { $('message').textContent = str; }
function post(payload) { iframe.contentWindow?.postMessage(payload, origin); }
function currentItem() { return items.find(item => item.path === activePath); }
function saveActiveInMemory() { const item=currentItem(); if (item) item.code=currentCode; }
function renderFiles() {
  $('count').textContent = `${items.length} file`;
  $('explorerToggleCount').textContent = `(${items.length})`;
  const box=$('files'); box.replaceChildren();
  if(!items.length){ const e=document.createElement('div');e.className='empty-list';e.textContent='Belum ada file. Klik Open File atau Open Folder.';box.append(e);return; }
  for(const item of items){
    const b=document.createElement('button');b.type='button';b.className='file-item'+(item.path===activePath?' active':'');
    const info=document.createElement('span');info.textContent=item.name;
    if(item.path!==item.name){const small=document.createElement('small');small.textContent=item.path;info.append(small);}
    b.append(info);b.title=item.path;b.onclick=()=>activate(item.path);box.append(b);
  }
}
function populate() {
  if(!ready) return;
  // Official OneCompiler embed API.
  lastSent={eventType:'populateCode', language:'cpp',files:[{name:filename,content:currentCode}]};
  post(lastSent);
}
function activate(path){
  const item=items.find(x=>x.path===path);if(!item)return;
  saveActiveInMemory(); activePath=path;filename=item.name;currentCode=item.code;
  revision++;$('activeName').textContent=item.path;renderFiles();populate();
  message(`File aktif: ${item.path}. Klik Compile & Run untuk menjalankan file ini.`);
  if (window.matchMedia('(max-width: 680px)').matches) setExplorer(false);
}
function newFile(){
  saveActiveInMemory();activePath=null;filename='tanpa_judul.cpp';currentCode='';revision++;
  $('activeName').textContent='File baru (belum disimpan)';renderFiles();populate();
  message('File baru kosong. Ketik kode C++ lalu klik Compile & Run.');
}
async function acceptFiles(files,folder){
  const selected=Array.from(files).filter(f=>supported.test(f.name));
  if(!selected.length){message('Tidak ditemukan file C++ yang didukung (.cpp, .cc, .cxx, .h, .hpp, .txt).');return;}
  if(selected.length>200){message('Maksimal 200 file C++ per folder untuk menjaga editor tetap ringan.');return;}
  if(selected.some(f=>f.size>1024*1024)){message('Setiap file maksimal 1 MB.');return;}
  try {
    const loaded=await Promise.all(selected.map(async f=>({name:f.name,path:(folder&&f.webkitRelativePath)||f.name,code:await f.text()})));
    saveActiveInMemory();items=loaded.sort((a,b)=>a.path.localeCompare(b.path));
    $('folderLabel').textContent=folder?(loaded[0].path.split('/')[0]||'Folder lokal'):'File lokal';
    const primary=items.find(x=>/\.(cpp|cc|cxx)$/i.test(x.name))||items[0];
    activePath=null;activate(primary.path);
    message(`${items.length} file dibuka dari ${folder?'folder':'laptop'}. File aktif: ${primary.path}. Pilih file lain pada panel Explorer.`);
  } catch(error){message('Gagal membaca file lokal: '+error.message);}
}
function setExplorer(open){
  $('explorerPanel').classList.toggle('mobile-open', open);
  $('explorerToggle').setAttribute('aria-expanded', String(open));
}
$('explorerToggle').onclick=()=>setExplorer(!$('explorerPanel').classList.contains('mobile-open'));
$('new').onclick=newFile;
$('openFile').onclick=()=>$('filePicker').click();
$('openFolder').onclick=()=>$('folderPicker').click();
$('filePicker').addEventListener('change',async e=>{if(e.target.files?.length)await acceptFiles(e.target.files,false);e.target.value='';});
$('folderPicker').addEventListener('change',async e=>{if(e.target.files?.length)await acceptFiles(e.target.files,true);e.target.value='';});
iframe.addEventListener('load',()=>{
  ready=true;
  $('statusTag').textContent='Editor dimuat';
  populate();
  // Retry blank/opened source to override embedded sample code on delayed initialization.
  const rev=revision;
  setTimeout(()=>{if(rev===revision)populate();},700);
  setTimeout(()=>{if(rev===revision)populate();},1600);
});
window.addEventListener('message',e=>{
  if(e.origin!==origin||e.source!==iframe.contentWindow) return;
  const d=e.data;
  if(!d||typeof d!=='object'||d.language!=='cpp'||!Array.isArray(d.files))return;
  const f=d.files.find(x=>x&&typeof x.content==='string'&&x.name===filename)
    ||d.files.find(x=>x&&typeof x.content==='string'&&/\.(cpp|cc|cxx)$/i.test(x.name||''))
    ||d.files.find(x=>x&&typeof x.content==='string');
  if(!f) return;
  // Ignore stale initial sample event if a new code version was just populated.
  if(lastSent && f.content!==lastSent.files[0].content && !document.hasFocus()) return;
  currentCode=f.content;saveActiveInMemory();
  if(lastSent && f.content===lastSent.files[0].content)lastSent=null;
});
$('save').onclick=()=>{
  const blob=new Blob([currentCode],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  message('Mengunduh '+filename+'. File asli di folder laptop tidak ditimpa otomatis.');
};
$('run').onclick=()=>{
  if(!ready){message('OneCompiler belum termuat. Periksa koneksi internet atau blokir iframe pada browser.');return;}
  // The iframe editor holds live edits. Do not populate here, which could overwrite typed code.
  post({eventType:'triggerRun'});
  message('Perintah Compile & Run dikirim ke OneCompiler. Output dan STDIN ada dalam panel compiler.');
};
function setTheme(next){
  const light=next==='light';document.body.classList.toggle('light',light);
  $('theme').textContent=light?'☾ Tema gelap':'☀ Tema terang';
  try{localStorage.setItem('avie-devcpp-v6-theme',next);}catch{}
}
$('theme').onclick=()=>setTheme(document.body.classList.contains('light')?'dark':'light');
let theme='dark';try{theme=localStorage.getItem('avie-devcpp-v6-theme')||localStorage.getItem('avie-devcpp-v5-theme')||'dark';}catch{}setTheme(theme);
function clock(){const now=new Date();const timezone='Asia/Makassar';$('date').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);$('time').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now)+' WITA';}
clock();setInterval(clock,1000);$('year').textContent=new Date().getFullYear();
document.addEventListener('keydown',e=>{
  // Parent shortcuts only when parent (not embedded editor) has focus.
  if(e.key==='F9'){e.preventDefault();$('run').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();$('openFile').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}
});
newFile();
