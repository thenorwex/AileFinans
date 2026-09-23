(() => {
"use strict";

const KEY="ailefinans_v24";
const $=id=>document.getElementById(id);

let db={
  members:[],
  accounts:[],
  expenses:[],
  investments:[],
  vehicles:[],
  bills:[],
  incomes:[],
  expenseCategories:["Market","Yakıt","Fatura","Sağlık","Kira","Alışveriş","Restoran","Eğitim","Diğer"]
};

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}

function money(n,c="TRY"){
  try{return new Intl.NumberFormat("tr-TR",{style:"currency",currency:c}).format(Number(n)||0)}
  catch(e){return (Number(n)||0).toFixed(2)+" "+c}
}

function save(){
  try{
    localStorage.setItem(KEY,JSON.stringify(db));
    $("status").textContent="Kaydedildi";
    return true;
  }catch(e){
    console.error(e);
    $("status").textContent="Kayıt hatası";
    return false;
  }
}

function load(){
  let raw=null;
  try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){
    try{
      const x=JSON.parse(raw);
      if(x && typeof x==="object") db={...db,...x};
    }catch(e){}
  }
  if(!Array.isArray(db.expenseCategories)||!db.expenseCategories.length)db.expenseCategories=["Market","Yakıt","Fatura","Sağlık","Kira","Alışveriş","Restoran","Eğitim","Diğer"];
  if(!Array.isArray(db.vehicles))db.vehicles=[];
  if(!Array.isArray(db.vehicleKmLogs))db.vehicleKmLogs=[];
  if(!Array.isArray(db.vehicleFuelLogs))db.vehicleFuelLogs=[];
  if(!Array.isArray(db.vehicleServices))db.vehicleServices=[];
  if(!Array.isArray(db.vehicleDocuments))db.vehicleDocuments=[];
  for(const k of ["members","accounts","expenses","investments","vehicles","bills","incomes"]){
    if(!Array.isArray(db[k]))db[k]=[];
  }
  db.settings={appName:"Aile Finans",currency:"TRY",theme:"system",refreshSeconds:30,autoUpdate:true,customPriceUrl:"",customPriceMode:"auto",customPriceSelector:"",customPriceJsonPath:"",customPriceRegex:"",... (db.settings||{})};
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    if(!file){resolve("");return}
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}
function photoThumb(x){
  return x.photo ? `<img class="expense-photo" src="${x.photo}" alt="Harcama fotoğrafı">` : "";
}


const investmentTypeLabel={gold:"Altın",crypto:"Kripto",currency:"Döviz",stock:"Hisse",fund:"Fon",manual:"Diğer"};
let investmentTimer=null;
function investmentCurrency(x){return x.currency||db.settings.currency||"TRY";}
function investmentCard(x){
  const live=Number(x.livePrice), qty=Number(x.quantity)||0, value=Number.isFinite(live)&&live>0?live*qty:null;
  const cost=(Number(x.buyPrice)||0)*qty;
  const diff=value==null?null:value-cost;
  const c=investmentCurrency(x);
  const change=diff==null?"":`<span class="${diff>=0?"gain":"loss"}">${diff>=0?"+":""}${money(diff,c)}</span>`;
  const status=x.liveUpdatedAt?`<span class="live-dot"></span> Güncellendi ${new Date(x.liveUpdatedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:`<span class="muted">Fiyat bekleniyor</span>`;
  return `<div class="item investment-card"><span><b>${escapeHtml(x.name)}</b><br><span class="muted">${investmentTypeLabel[x.type]||"Diğer"} · ${qty}${x.type==="gold"?" g":""}</span><br><small class="live-status">${status}</small></span><span class="investment-value"><b>${value==null?"—":money(value,c)}</b><br>${change}</span></div>`;
}
function withCacheBust(url){
  const sep=url.includes("?")?"&":"?";
  return url+sep+"_afcb="+Date.now();
}
async function fetchJson(url,timeout=10000){
  const directUrl=withCacheBust(url);
  let directError=null;
  try{
    const ctrl=new AbortController(), t=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const r=await fetch(directUrl,{cache:"no-store",signal:ctrl.signal});
      if(!r.ok)throw new Error("HTTP "+r.status);
      return await r.json();
    }finally{clearTimeout(t)}
  }catch(e){directError=e}

  // The app is often opened as file://. Several market APIs intentionally
  // do not expose browser CORS, so use public CORS relays as a fallback.
  const proxied=[
    "https://api.allorigins.win/raw?url="+encodeURIComponent(directUrl),
    "https://corsproxy.io/?url="+encodeURIComponent(directUrl)
  ];
  let last=directError;
  for(const u of proxied){
    try{
      const ctrl=new AbortController(), t=setTimeout(()=>ctrl.abort(),timeout);
      try{
        const r=await fetch(u,{cache:"no-store",signal:ctrl.signal});
        if(!r.ok)throw new Error("Proxy HTTP "+r.status);
        return await r.json();
      }finally{clearTimeout(t)}
    }catch(e){last=e}
  }
  throw last||new Error("Fiyat kaynağına ulaşılamadı");
}
async function fetchFirst(urls){
  let last=null;
  for(const u of urls){try{return await fetchJson(u)}catch(e){last=e}}
  throw last||new Error("Kaynak yok");
}
function pickQuote(data, currency){
  const row=data?.symbols?.[0];
  if(!row?.price)return null;
  return Number(row.price);
}
async function getGoldTRY(){
  const d=await fetchFirst([
    "https://api.goldprice.dev/v1/carat?currency=TRY",
    "https://api.goldprice.dev/v1/prices?symbol=XAU-TRY-SPOT"
  ]);
  if(d.price_gram_24k)return Number(d.price_gram_24k);
  const p=pickQuote(d,"TRY");
  return p?Number(p):null;
}
async function getGold(currency){
  if(currency==="TRY")return getGoldTRY();
  const d=await fetchJson("https://api.goldprice.dev/v1/carat?currency="+encodeURIComponent(currency));
  return Number(d.price_gram_24k)||null;
}
async function getCrypto(ids,currencies){
  if(!ids.length)return {};
  const d=await fetchFirst([
    "https://api.coingecko.com/api/v3/simple/price?ids="+encodeURIComponent(ids.join(","))+"&vs_currencies="+currencies.join(","),
    "https://api.coingecko.com/api/v3/simple/price?ids="+encodeURIComponent(ids.join(","))+"&vs_currencies=usd"
  ]);
  const out={};
  for(const id of ids)out[id]=d[id]||{};
  return out;
}

function getByPath(obj,path){
  if(!path)return obj;
  return path.split(".").filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],obj);
}
function parsePriceText(text){
  if(text==null)return null;
  const cleaned=String(text).replace(/\s/g,"").replace(/[₺$€£]/g,"");
  const matches=cleaned.match(/-?\d+(?:[.,]\d+)?/g);
  if(!matches?.length)return null;
  // Prefer the last numeric value, which is usually the displayed price in a price element.
  const raw=matches[matches.length-1];
  const normalized=raw.includes(",")&&raw.includes(".")
    ? (raw.lastIndexOf(",")>raw.lastIndexOf(".") ? raw.replace(/\./g,"").replace(",",".") : raw.replace(/,/g,""))
    : raw.replace(",",".");
  const n=Number(normalized);
  return Number.isFinite(n)&&n>0?n:null;
}
async function getCustomPrice(){
  const s=db.settings||{};
  if(!s.customPriceUrl)return null;
  const url=withCacheBust(s.customPriceUrl);
  let text="";
  let contentType="";
  const directAndProxy=[
    url,
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://corsproxy.io/?url="+encodeURIComponent(url)
  ];
  let last=null;
  for(const u of directAndProxy){
    try{
      const ctrl=new AbortController(), t=setTimeout(()=>ctrl.abort(),12000);
      try{
        const r=await fetch(u,{cache:"no-store",signal:ctrl.signal});
        if(!r.ok)throw new Error("HTTP "+r.status);
        contentType=(r.headers.get("content-type")||"").toLowerCase();
        text=await r.text();
        break;
      }finally{clearTimeout(t)}
    }catch(e){last=e}
  }
  if(!text)throw last||new Error("Özel fiyat kaynağına ulaşılamadı");

  const mode=s.customPriceMode||"auto";
  if(mode==="json" || (mode==="auto" && /json/i.test(contentType))){
    const data=JSON.parse(text);
    const value=getByPath(data,s.customPriceJsonPath||"");
    const p=parsePriceText(typeof value==="object"?JSON.stringify(value):value);
    if(p)return p;
    throw new Error("JSON yolunda fiyat bulunamadı");
  }

  const doc=new DOMParser().parseFromString(text,"text/html");
  if(s.customPriceSelector){
    const el=doc.querySelector(s.customPriceSelector);
    const p=parsePriceText(el?.textContent);
    if(p)return p;
    throw new Error("CSS seçicide fiyat bulunamadı");
  }
  if(s.customPriceRegex){
    const m=text.match(new RegExp(s.customPriceRegex,"i"));
    const p=parsePriceText(m?.[1]||m?.[0]);
    if(p)return p;
    throw new Error("Regex ile fiyat bulunamadı");
  }
  const p=parsePriceText(doc.body?.innerText||text);
  if(p)return p;
  throw new Error("Sayfada sayısal fiyat bulunamadı");
}
async function updateInvestments(){
  const list=db.investments||[];
  if(!list.length){renderReport();return}
  const now=Date.now();
  const groups={};
  list.forEach(x=>{const key=x.type+":"+investmentCurrency(x);(groups[key]??=[]).push(x)});
  let success=0;
  for(const [key,items] of Object.entries(groups)){
    const [type,currency]=key.split(":");
    try{
      if(type==="gold"){
        let p=null;
        if(db.settings.customPriceUrl) {
          try{ p=await getCustomPrice(); }catch(e){ p=null; }
        }
        if(!(Number.isFinite(p)&&p>0)) p=await getGold(currency);
        if(Number.isFinite(p)&&p>0)items.forEach(x=>{x.livePrice=p;x.liveUpdatedAt=now;success++});
      }else if(type==="crypto"){
        const ids=[...new Set(items.map(x=>x.symbol.trim().toLowerCase()).filter(Boolean))];
        const prices=await getCrypto(ids,[currency.toLowerCase()]);
        items.forEach(x=>{const p=Number(prices[x.symbol.trim().toLowerCase()]?.[currency.toLowerCase()]??prices[x.symbol.trim().toLowerCase()]?.usd);if(Number.isFinite(p)&&p>0){x.livePrice=p;x.liveUpdatedAt=now;success++}});
      }else if(type==="currency"){
        const symbols=[...new Set(items.map(x=>x.symbol.trim().toUpperCase()).filter(Boolean))];
        for(const sym of symbols){
          if(sym===currency){items.filter(x=>x.symbol.trim().toUpperCase()===sym).forEach(x=>{x.livePrice=1;x.liveUpdatedAt=now;success++});continue}
          const d=await fetchJson("https://api.frankfurter.dev/v2/rate/"+encodeURIComponent(sym)+"/"+encodeURIComponent(currency));
          const p=Number(d.rate);
          items.filter(x=>x.symbol.trim().toUpperCase()===sym).forEach(x=>{if(p>0){x.livePrice=p;x.liveUpdatedAt=now;success++}});
        }
      }else if(type==="stock"||type==="fund"){
        for(const x of items){
          if(!x.symbol)continue;
          try{
            const d=await fetchFirst([
              "https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(x.symbol)+"?range=1d&interval=1m",
              "https://query2.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(x.symbol)+"?range=1d&interval=1m"
            ]);
            const r=d.chart?.result?.[0], p=Number(r?.meta?.regularMarketPrice);
            if(p>0){x.livePrice=p;x.liveUpdatedAt=now;success++}
          }catch(e){}
        }
      }
    }catch(e){}
  }
  save();
  render();
  $("status").textContent=success
    ? `Yatırımlar güncellendi · ${success} fiyat`
    : "Fiyat sağlayıcılarına ulaşılamadı · son fiyatlar korunuyor";
}
function startInvestmentRefresh(){
  clearInterval(investmentTimer);
  if(db.settings.autoUpdate!==false){
    updateInvestments();
    investmentTimer=setInterval(updateInvestments,Math.max(30,Number(db.settings.refreshSeconds)||30)*1000);
  }
}
function render(){
  if($("memberCount"))$("memberCount").textContent=db.members.length;
  $("totalBalance").textContent=money(db.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),"TRY");
  const ym=new Date().toISOString().slice(0,7);
  const monthIncomeValue=(db.incomes||[]).filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+(Number(x.amount)||0),0);
  const monthExpenseValue=db.expenses.filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+(Number(x.amount)||0),0);
  const investmentValue=(db.investments||[]).reduce((s,x)=>s+(Number(x.livePrice)>0?Number(x.livePrice)*Number(x.quantity||0):0),0);
  $("monthExpense").textContent=money(monthExpenseValue,"TRY");
  if($("monthIncome"))$("monthIncome").textContent=money(monthIncomeValue,"TRY");
  if($("investmentTotal"))$("investmentTotal").textContent=money(investmentValue,"TRY");
  if($("homeNet"))$("homeNet").textContent=money(monthIncomeValue-monthExpenseValue,"TRY");
  if($("homeMonthLabel"))$("homeMonthLabel").textContent=new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date());

  $("homeMembers").innerHTML=db.members.length
    ? db.members.map((m,i)=>`<div class="item"><span>${escapeHtml(m)}</span><button data-remove-member="${i}">Sil</button></div>`).join("")
    : `<div class="empty">Henüz üye yok.</div>`;

  $("expenseList").innerHTML=db.expenses.length
    ? db.expenses.slice().reverse().map(x=>`<div class="item expense-row">
        <span class="expense-main">${photoThumb(x)}<span><b>${escapeHtml(x.title)}</b><br><span class="muted">${escapeHtml(x.member||"")} · ${escapeHtml(x.category||"Diğer")} · ${escapeHtml(x.date||"")}</span></span></span>
        <span class="row-actions"><b>${money(x.amount,x.currency||"TRY")}</b><button data-edit-expense="${x.id}">Düzenle</button><button data-delete-expense="${x.id}">Sil</button></span>
      </div>`).join("")
    : `<div class="empty">Henüz harcama yok.</div>`;

  $("investmentList").innerHTML=db.investments.length
    ? db.investments.slice().reverse().map(x=>investmentCard(x)).join("")
    : `<div class="empty">Henüz yatırım yok.</div>`;
  if($("vehiclePageList"))$("vehiclePageList").innerHTML=db.vehicles.length
    ? db.vehicles.map(v=>`<div class="item"><span><b>${escapeHtml(v.name)}</b><br><span class="muted">${escapeHtml(v.plate||"Plaka yok")} · ${vehicleKm(v).toLocaleString("tr-TR")} km</span></span><button data-open-vehicle="${v.id}">Aç</button></div>`).join("")
    : `<div class="empty">Henüz araç eklenmedi.</div>`;

  renderReport();
  renderSettings();
}


function renderReport(){
  const ym=new Date().toISOString().slice(0,7);
  const monthName=new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date());
  const incomes=(db.incomes||[]).filter(x=>String(x.date||"").slice(0,7)===ym);
  const expenses=db.expenses.filter(x=>String(x.date||"").slice(0,7)===ym);
  const income=incomes.reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const net=income-expense;
  const cats={}; expenses.forEach(x=>cats[x.category||"Diğer"]=(cats[x.category||"Diğer"]||0)+Number(x.amount||0));
  const inv=(db.investments||[]).reduce((s,x)=>s+(Number(x.livePrice)>0?Number(x.livePrice)*Number(x.quantity||0):0),0);
  const fuel=(db.vehicleFuelLogs||[]).filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+Number(x.total||0),0);
  const service=(db.vehicleServices||[]).filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+Number(x.cost||0),0);
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div class="report-row"><span>${escapeHtml(k)}</span><b>${money(v,"TRY")}</b></div>`).join("")||'<div class="empty">Bu ay harcama yok.</div>';
  $("reportText").innerHTML=`
    <div class="report-hero"><div><small>${monthName}</small><h3>Net Nakit Akışı</h3><div class="report-big ${net>=0?"gain":"loss"}">${net>=0?"+":""}${money(net,"TRY")}</div></div><span class="report-icon">₺</span></div>
    <div class="report-grid">
      <div class="report-card"><small>Gelir</small><b>${money(income,"TRY")}</b><span>${incomes.length} işlem</span></div>
      <div class="report-card"><small>Gider</small><b>${money(expense,"TRY")}</b><span>${expenses.length} işlem</span></div>
      <div class="report-card"><small>Yatırım Değeri</small><b>${money(inv,"TRY")}</b><span>${db.investments.length} yatırım</span></div>
      <div class="report-card"><small>Araç Gideri</small><b>${money(fuel+service,"TRY")}</b><span>Yakıt + bakım</span></div>
    </div>
    <div class="report-columns"><div class="panel"><h3>Harcama Dağılımı</h3>${catRows}</div>
      <div class="panel"><h3>Finans Özeti</h3><div class="report-row"><span>Toplam hesap bakiyesi</span><b>${money(db.accounts.reduce((s,a)=>s+Number(a.balance||0),0),"TRY")}</b></div><div class="report-row"><span>Aile üyesi</span><b>${db.members.length}</b></div><div class="report-row"><span>Araç</span><b>${db.vehicles.length}</b></div><div class="report-row"><span>Yatırım</span><b>${db.investments.length}</b></div></div>
    </div>`;
}
function renderSettings(){
  const s=db.settings||{};
  $("settingAppName").value=s.appName||"Aile Finans";
  $("settingCurrency").value=s.currency||"TRY";
  $("settingTheme").value=s.theme||"system";
  $("settingRefresh").value=String(s.refreshSeconds||30);
  $("settingPriceUrl").value=s.customPriceUrl||"";
  $("settingPriceMode").value=s.customPriceMode||"auto";
  $("settingPriceSelector").value=s.customPriceSelector||"";
  $("settingPriceJsonPath").value=s.customPriceJsonPath||"";
  $("settingPriceRegex").value=s.customPriceRegex||"";
  $("settingAutoUpdate").checked=s.autoUpdate!==false;
  $("settingCategories").value=(db.expenseCategories||[]).join(", ");
  $("appSubtitle").textContent=s.appName==="Aile Finans"?"Aile bütçesi":"Finans takip";
}
function applyTheme(){
  const t=db.settings.theme||"system";
  document.documentElement.dataset.theme=t;
}
function toast(msg){
  const t=$("toast"); if(!t)return;
  t.textContent=msg;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),2200);
}
$("openSettings").onclick=()=>{renderSettings();openModal("settingsModal")};
$("saveSettings").onclick=()=>{
  db.settings.appName=$("settingAppName").value.trim()||"Aile Finans";
  db.settings.currency=$("settingCurrency").value;
  db.settings.theme=$("settingTheme").value;
  db.settings.refreshSeconds=Number($("settingRefresh").value)||30;
  db.settings.autoUpdate=$("settingAutoUpdate").checked;
  db.settings.customPriceUrl=$("settingPriceUrl").value.trim();
  db.settings.customPriceMode=$("settingPriceMode").value;
  db.settings.customPriceSelector=$("settingPriceSelector").value.trim();
  db.settings.customPriceJsonPath=$("settingPriceJsonPath").value.trim();
  db.settings.customPriceRegex=$("settingPriceRegex").value.trim();
  db.expenseCategories=$("settingCategories").value.split(",").map(x=>x.trim()).filter(Boolean);
  save();applyTheme();startInvestmentRefresh();render();closeModal("settingsModal");toast("Ayarlar kaydedildi");
};
$("saveCategorySettings").onclick=()=>{
  db.expenseCategories=$("settingCategories").value.split(",").map(x=>x.trim()).filter(Boolean);
  save();render();toast("Kategoriler kaydedildi");
};
$("exportData").onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="aile-finans-yedek.json";a.click();URL.revokeObjectURL(a.href);toast("Yedek hazırlandı");
};
$("importDataBtn").onclick=()=>$("importData").click();
$("importData").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const x=JSON.parse(await f.text());if(!x||typeof x!=="object"||!Array.isArray(x.expenses))throw new Error();
    db={...db,...x};db.settings={appName:"Aile Finans",currency:"TRY",theme:"system",refreshSeconds:30,autoUpdate:true,...(x.settings||{})};save();applyTheme();render();startInvestmentRefresh();toast("Yedek yüklendi");
  }catch(err){toast("Yedek dosyası geçersiz");}e.target.value="";
});
$("clearData").onclick=()=>{
  if(!confirm("Tüm aile finans verileri silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"))return;
  const keep={settings:db.settings,expenseCategories:db.expenseCategories};
  db={members:[],accounts:[],expenses:[],investments:[],vehicles:[],bills:[],incomes:[],vehicleKmLogs:[],vehicleFuelLogs:[],vehicleServices:[],vehicleDocuments:[],...keep};
  save();render();toast("Veriler temizlendi");
};
$("openIncome").onclick=()=>{
  $("incomeMember").innerHTML='<option value="">Üye seç</option>'+db.members.map(m=>`<option>${escapeHtml(m)}</option>`).join("");
  $("incomeAccount").innerHTML='<option value="">Hesaba ekleme</option>'+db.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} (${money(a.balance,a.currency)})</option>`).join("");
  $("incomeDate").value=today();openModal("incomeModal");
};
$("incomeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("incomeAmount").value);if(!amount||amount<0)return;
  const account=db.accounts.find(a=>a.id===$("incomeAccount").value);
  db.incomes.push({id:uid(),title:$("incomeTitle").value.trim(),amount,currency:$("incomeCurrency").value,member:$("incomeMember").value,date:$("incomeDate").value||today(),accountId:account?.id||"",note:$("incomeNote").value.trim()});
  if(account&&account.currency===$("incomeCurrency").value)account.balance+=amount;
  save();$("incomeForm").reset();closeModal("incomeModal");render();toast("Gelir kaydedildi");
});
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function openModal(id){
  const m=$(id);
  if(!m)return;
  m.hidden=false;
  m.setAttribute("aria-hidden","false");
}

function closeModal(id){
  const m=$(id);
  if(!m)return;
  m.hidden=true;
  m.setAttribute("aria-hidden","true");
}

function page(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  document.querySelectorAll("#sideNav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  if(name==="investments")updateInvestments();
  if(name==="reports")renderReport();
  window.scrollTo(0,0);
}
$("sideNav").addEventListener("click",e=>{
  const b=e.target.closest("button[data-page]"); if(!b)return;
  e.preventDefault(); page(b.dataset.page);
});

/* ONE and only one member submit listener. */
$("memberForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("memberName").value.trim();
  if(!name)return;
  db.members.push(name);
  if(!save())return;
  $("memberForm").reset();
  closeModal("memberModal");
  render();
});

/* ONE and only one account submit listener. */
$("accountForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("accountName").value.trim();
  if(!name)return;
  db.accounts.push({
    id:uid(),
    name,
    type:$("accountType").value,
    balance:Number($("accountBalance").value)||0,
    currency:$("accountCurrency").value
  });
  if(!save())return;
  $("accountForm").reset();
  closeModal("accountModal");
  render();
});

/* Modal close buttons. */
document.addEventListener("click",e=>{
  const vo=e.target.closest("[data-open-vehicle]");
  if(vo){const v=vehicleById(vo.dataset.openVehicle);if(v){openVehicle(v);setTimeout(()=>$("vehicleDetailModal").querySelector(".modalbox")?.scrollTo(0,0),0)}return;}
  const b=e.target.closest("[data-close]");
  if(b){e.preventDefault();closeModal(b.dataset.close);return}
  const rm=e.target.closest("[data-remove-member]");
  if(rm){
    const i=Number(rm.dataset.removeMember);
    if(Number.isInteger(i)){db.members.splice(i,1);save();render()}
  }
});

/* More screen shortcuts. */
$("openMembers").onclick=()=>{
  $("listTitle").textContent="Üyeler";
  $("listBody").innerHTML=db.members.length
    ? db.members.map((m,i)=>`<div class="item"><span>${escapeHtml(m)}</span><button data-remove-member="${i}">Sil</button></div>`).join("")
    : `<div class="empty">Üye yok.</div>`;
  $("listAdd").onclick=()=>{closeModal("listModal");openModal("memberModal")};
  openModal("listModal");
};
let editAccountId=null;

function showAccounts(){
  $("listTitle").textContent="Hesaplar / Kartlar";
  $("listBody").innerHTML=db.accounts.length
    ? db.accounts.map(a=>`<div class="item account-row">
        <span><b>${escapeHtml(a.name)}</b><br><span class="muted">${escapeHtml(a.type)} · ${money(a.balance,a.currency)}</span></span>
        <span class="row-actions">
          <button data-edit-account="${a.id}">Düzenle</button>
          <button data-delete-account="${a.id}">Sil</button>
        </span>
      </div>`).join("")
    : `<div class="empty">Hesap yok.</div>`;
  $("listAdd").onclick=()=>{closeModal("listModal");openModal("accountModal")};
  openModal("listModal");
}

$("openAccounts").onclick=showAccounts;

document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-account]");
  if(edit){
    const a=db.accounts.find(x=>x.id===edit.dataset.editAccount);
    if(!a)return;
    editAccountId=a.id;
    $("editAccountName").value=a.name||"";
    $("editAccountType").value=a.type||"Diğer";
    $("editAccountBalance").value=Number(a.balance)||0;
    $("editAccountCurrency").value=a.currency||"TRY";
    closeModal("listModal");
    openModal("accountEditModal");
    return;
  }
  const del=e.target.closest("[data-delete-account]");
  if(del){
    const a=db.accounts.find(x=>x.id===del.dataset.deleteAccount);
    if(!a)return;
    if(!confirm(`"${a.name}" hesabı silinsin mi?`))return;
    db.accounts=db.accounts.filter(x=>x.id!==a.id);
    save();
    render();
    showAccounts();
  }
});

$("accountEditForm").addEventListener("submit",e=>{
  e.preventDefault();
  const a=db.accounts.find(x=>x.id===editAccountId);
  if(!a)return;
  const name=$("editAccountName").value.trim();
  if(!name)return;
  a.name=name;
  a.type=$("editAccountType").value;
  a.balance=Number($("editAccountBalance").value)||0;
  a.currency=$("editAccountCurrency").value;
  save();
  closeModal("accountEditModal");
  editAccountId=null;
  render();
  showAccounts();
});


let activeVehicleId=null;
const today=()=>new Date().toISOString().slice(0,10);
const vehicleById=id=>db.vehicles.find(v=>v.id===id);
const vehicleKm=v=>Math.max(Number(v.km)||0,...db.vehicleKmLogs.filter(x=>x.vehicleId===v.id).map(x=>Number(x.km)||0),...db.vehicleFuelLogs.filter(x=>x.vehicleId===v.id).map(x=>Number(x.km)||0));
const fillAccountSelect=id=>{$(id).innerHTML=db.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} (${money(a.balance,a.currency)})</option>`).join("")};

function showVehicles(){
  $("vehicleList").innerHTML=db.vehicles.length?db.vehicles.map(v=>`<div class="item"><span><b>${escapeHtml(v.name)}</b><br><span class="muted">${escapeHtml(v.plate||"Plaka yok")} · ${vehicleKm(v).toLocaleString("tr-TR")} km · ${escapeHtml(v.fuel||"")}</span></span><span class="row-actions"><button data-open-vehicle="${v.id}">Aç</button><button data-delete-vehicle="${v.id}">Sil</button></span></div>`).join(""):'<div class="empty">Henüz araç eklenmedi.</div>';
  openModal("vehicleListModal");
}
$("openVehicles").onclick=showVehicles;
if($("vehiclePageAdd"))$("vehiclePageAdd").onclick=()=>{ $("vehicleForm").reset(); openModal("vehicleModal"); };
$("vehicleAddBtn").onclick=()=>{closeModal("vehicleListModal");$("vehicleForm").reset();openModal("vehicleModal")};

function openVehicle(v){
  activeVehicleId=v.id;
  const fuels=db.vehicleFuelLogs.filter(x=>x.vehicleId===v.id).sort((a,b)=>b.date.localeCompare(a.date));
  const services=db.vehicleServices.filter(x=>x.vehicleId===v.id).sort((a,b)=>b.date.localeCompare(a.date));
  const docs=db.vehicleDocuments.filter(x=>x.vehicleId===v.id).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  const fuelCost=fuels.reduce((s,x)=>s+Number(x.total||0),0), serviceCost=services.reduce((s,x)=>s+Number(x.cost||0),0);
  $("vehicleDetailTitle").textContent=v.name;
  $("vehicleDetailSummary").innerHTML=`<b>${escapeHtml(v.name)}</b><br>${escapeHtml(v.plate||"")} · ${vehicleKm(v).toLocaleString("tr-TR")} km<br>Yakıt: ${money(fuelCost,"TRY")} · Bakım: ${money(serviceCost,"TRY")}`;
  $("vehicleHistory").innerHTML=(fuels.map(x=>`<div class="item"><span>⛽ ${x.liters} L · ${x.date} · ${x.km.toLocaleString("tr-TR")} km</span><b>${money(x.total,"TRY")}</b></div>`).join("")+
    services.map(x=>`<div class="item"><span>🔧 ${escapeHtml(x.title)} · ${x.date} · ${(Number(x.km)||0).toLocaleString("tr-TR")} km</span><b>${money(x.cost||0,"TRY")}</b></div>`).join("")+
    docs.map(x=>`<div class="item"><span>📄 ${escapeHtml(x.type)} · ${x.date} → ${x.expiry}</span><b>${money(x.cost||0,"TRY")}</b></div>`).join("")||'<div class="empty">Henüz kayıt yok.</div>');
  openModal("vehicleDetailModal");
}

$("vehicleAddKmBtn").onclick=()=>{closeModal("vehicleDetailModal");$("vehicleKmForm").reset();$("vehicleKmDate").value=today();$("vehicleKmValue").value=vehicleKm(vehicleById(activeVehicleId));openModal("vehicleKmModal")};
$("vehicleAddFuelBtn").onclick=()=>{closeModal("vehicleDetailModal");$("vehicleFuelForm").reset();$("vehicleFuelDate").value=today();$("vehicleFuelKm").value=vehicleKm(vehicleById(activeVehicleId));fillAccountSelect("vehicleFuelAccount");openModal("vehicleFuelModal")};
$("vehicleAddServiceBtn").onclick=()=>{closeModal("vehicleDetailModal");$("vehicleServiceForm").reset();$("vehicleServiceDate").value=today();$("vehicleServiceKm").value=vehicleKm(vehicleById(activeVehicleId));fillAccountSelect("vehicleServiceAccount");openModal("vehicleServiceModal")};
$("vehicleAddInsuranceBtn").onclick=()=>{closeModal("vehicleDetailModal");$("vehicleInsuranceForm").reset();$("vehicleDocDate").value=today();$("vehicleDocExpiry").value=today();fillAccountSelect("vehicleDocAccount");openModal("vehicleInsuranceModal")};

$("vehicleForm").addEventListener("submit",e=>{
  e.preventDefault();const name=$("vehicleName").value.trim();if(!name)return;
  db.vehicles.push({id:uid(),name,plate:$("vehiclePlate").value.trim(),km:Number($("vehicleKm").value)||0,fuel:$("vehicleFuel").value.trim()});
  save();$("vehicleForm").reset();closeModal("vehicleModal");render();showVehicles();
});
$("vehicleKmForm").addEventListener("submit",e=>{
  e.preventDefault();const v=vehicleById(activeVehicleId),km=Number($("vehicleKmValue").value);if(!v||km<0)return;
  db.vehicleKmLogs.push({id:uid(),vehicleId:v.id,km,date:$("vehicleKmDate").value||today(),note:$("vehicleKmNote").value.trim()});v.km=Math.max(Number(v.km)||0,km);save();closeModal("vehicleKmModal");render();openVehicle(v);
});
$("vehicleFuelForm").addEventListener("submit",async e=>{
  e.preventDefault();const v=vehicleById(activeVehicleId),liters=Number($("vehicleFuelLiters").value),price=Number($("vehicleFuelPrice").value),total=Number($("vehicleFuelTotal").value),km=Number($("vehicleFuelKm").value);if(!v||liters<=0||price<0||total<0||km<0)return;
  const accountId=$("vehicleFuelAccount").value,a=db.accounts.find(x=>x.id===accountId);if(a&&a.currency==="TRY")a.balance-=total;
  db.vehicleFuelLogs.push({id:uid(),vehicleId:v.id,liters,price,total,km,accountId,date:$("vehicleFuelDate").value||today(),station:$("vehicleFuelStation").value.trim(),photo:await fileToDataUrl($("vehicleFuelPhoto").files[0])});
  v.km=Math.max(Number(v.km)||0,km);save();closeModal("vehicleFuelModal");render();openVehicle(v);
});
$("vehicleServiceForm").addEventListener("submit",async e=>{
  e.preventDefault();const v=vehicleById(activeVehicleId),cost=Number($("vehicleServiceCost").value)||0,km=Number($("vehicleServiceKm").value)||0;if(!v||cost<0||km<0)return;
  const accountId=$("vehicleServiceAccount").value,a=db.accounts.find(x=>x.id===accountId);if(a&&a.currency==="TRY")a.balance-=cost;
  db.vehicleServices.push({id:uid(),vehicleId:v.id,title:$("vehicleServiceTitle").value.trim(),cost,km,nextKm:Number($("vehicleServiceNextKm").value)||0,accountId,date:$("vehicleServiceDate").value||today(),note:$("vehicleServiceNote").value.trim(),photo:await fileToDataUrl($("vehicleServicePhoto").files[0])});
  v.km=Math.max(Number(v.km)||0,km);save();closeModal("vehicleServiceModal");render();openVehicle(v);
});
$("vehicleInsuranceForm").addEventListener("submit",e=>{
  e.preventDefault();const v=vehicleById(activeVehicleId),cost=Number($("vehicleDocCost").value)||0;if(!v)return;
  const accountId=$("vehicleDocAccount").value,a=db.accounts.find(x=>x.id===accountId);if(a&&a.currency==="TRY")a.balance-=cost;
  db.vehicleDocuments.push({id:uid(),vehicleId:v.id,type:$("vehicleDocType").value,date:$("vehicleDocDate").value,expiry:$("vehicleDocExpiry").value,cost,accountId,note:$("vehicleDocNote").value.trim()});save();closeModal("vehicleInsuranceModal");render();openVehicle(v);
});

document.addEventListener("click",e=>{
  const op=e.target.closest("[data-open-vehicle]");
  if(op){const v=vehicleById(op.dataset.openVehicle);if(v){closeModal("vehicleListModal");openVehicle(v)}return}
  const del=e.target.closest("[data-delete-vehicle]");
  if(!del)return;
  const v=db.vehicles.find(x=>x.id===del.dataset.deleteVehicle);
  if(!v)return;
  if(!confirm(`"${v.name}" aracı silinsin mi?`))return;
  for(const x of db.vehicleFuelLogs.filter(x=>x.vehicleId===v.id)){const a=db.accounts.find(q=>q.id===x.accountId);if(a&&a.currency==="TRY")a.balance+=Number(x.total||0);}
  for(const x of db.vehicleServices.filter(x=>x.vehicleId===v.id)){const a=db.accounts.find(q=>q.id===x.accountId);if(a&&a.currency==="TRY")a.balance+=Number(x.cost||0);}
  for(const x of db.vehicleDocuments.filter(x=>x.vehicleId===v.id)){const a=db.accounts.find(q=>q.id===x.accountId);if(a&&a.currency==="TRY")a.balance+=Number(x.cost||0);}
  db.vehicleKmLogs=db.vehicleKmLogs.filter(x=>x.vehicleId!==v.id);
  db.vehicleFuelLogs=db.vehicleFuelLogs.filter(x=>x.vehicleId!==v.id);
  db.vehicleServices=db.vehicleServices.filter(x=>x.vehicleId!==v.id);
  db.vehicleDocuments=db.vehicleDocuments.filter(x=>x.vehicleId!==v.id);
  db.vehicles=db.vehicles.filter(x=>x.id!==v.id);
  save();render();showVehicles();
});
$("openBills").onclick=()=>{page("more");alert("Fatura modülü bir sonraki aşamada bağlanacak.")};
$("addExpense").onclick=()=>{
  const m=$("expenseMember");
  m.innerHTML=db.members.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  $("expenseCategory").innerHTML=db.expenseCategories.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
  $("expenseAccount").innerHTML=db.accounts.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
  $("expenseDate").value=new Date().toISOString().slice(0,10);
  openModal("expenseModal");
};
function adjustAccountForExpense(x, direction){
  const a=db.accounts.find(q=>q.id===x.accountId);
  if(!a || a.currency!==x.currency)return;
  a.balance += direction*Number(x.amount||0);
}

document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-expense]");
  if(edit){
    const x=db.expenses.find(q=>q.id===edit.dataset.editExpense);
    if(!x)return;
    $("editExpenseTitle").value=x.title||"";
    $("editExpenseAmount").value=Number(x.amount)||0;
    $("editExpenseCurrency").value=x.currency||"TRY";
    $("editExpenseMember").innerHTML=db.members.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
    $("editExpenseMember").value=x.member||"";
    $("editExpenseCategory").innerHTML=db.expenseCategories.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
    $("editExpenseCategory").value=x.category||"Diğer";
    $("editExpenseAccount").innerHTML=db.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    $("editExpenseAccount").value=x.accountId||"";
    $("editExpenseDate").value=x.date||"";
    $("editExpenseNote").value=x.note||"";
    $("editExpensePhoto").value="";
    $("expenseEditForm").dataset.id=x.id;
    openModal("expenseEditModal");
    return;
  }
  const del=e.target.closest("[data-delete-expense]");
  if(del){
    const x=db.expenses.find(q=>q.id===del.dataset.deleteExpense);
    if(!x)return;
    if(!confirm(`"${x.title}" harcaması silinsin mi?`))return;
    adjustAccountForExpense(x,+1);
    db.expenses=db.expenses.filter(q=>q.id!==x.id);
    save(); render();
  }
});

$("expenseEditForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const x=db.expenses.find(q=>q.id===$("expenseEditForm").dataset.id);
  if(!x)return;
  const old={...x};
  adjustAccountForExpense(old,+1);
  const amount=Number($("editExpenseAmount").value);
  if(!Number.isFinite(amount)||amount<=0)return;
  x.title=$("editExpenseTitle").value.trim();
  const newPhoto=await fileToDataUrl($("editExpensePhoto").files[0]);
  x.amount=amount;
  if(newPhoto)x.photo=newPhoto;
  x.currency=$("editExpenseCurrency").value;
  x.member=$("editExpenseMember").value||"";
  x.category=$("editExpenseCategory").value||"Diğer";
  x.accountId=$("editExpenseAccount").value||"";
  const a=db.accounts.find(q=>q.id===x.accountId);
  x.payment=a?a.name:"";
  x.date=$("editExpenseDate").value||new Date().toISOString().slice(0,10);
  x.note=$("editExpenseNote").value.trim();
  adjustAccountForExpense(x,-1);
  save(); closeModal("expenseEditModal"); render();
});

$("expenseForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const title=$("expenseTitle").value.trim();
  const amount=Number($("expenseAmount").value);
  if(!title || !Number.isFinite(amount) || amount<=0)return;
  const accountId=$("expenseAccount").value;
  const account=db.accounts.find(x=>x.id===accountId);
  const photo=await fileToDataUrl($("expensePhoto").files[0]);
  const currency=$("expenseCurrency").value;
  db.expenses.push({
    id:uid(),
    title,
    amount,
    currency,
    member:$("expenseMember").value||"",
    category:$("expenseCategory").value||"Diğer",
    accountId,
    payment:account?account.name:"",
    date:$("expenseDate").value||new Date().toISOString().slice(0,10),
    note:$("expenseNote").value.trim(),
    photo
  });
  if(account && account.currency===currency) account.balance-=amount;
  save();
  $("expenseForm").reset();
  closeModal("expenseModal");
  render();
});

$("addInvestment").onclick=()=>{ $("investmentForm").reset(); $("investmentBuyDate").value=new Date().toISOString().slice(0,10); openModal("investmentModal"); };
$("investmentForm").addEventListener("submit",e=>{
  e.preventDefault();
  const qty=Number($("investmentQuantity").value), buy=Number($("investmentBuyPrice").value)||0;
  if(!Number.isFinite(qty)||qty<=0)return;
  db.investments.push({id:uid(),type:$("investmentType").value,name:$("investmentName").value.trim(),symbol:$("investmentSymbol").value.trim(),quantity:qty,buyPrice:buy,currency:$("investmentCurrency").value,buyDate:$("investmentBuyDate").value,note:$("investmentNote").value.trim(),livePrice:0,liveUpdatedAt:0});
  save();closeModal("investmentModal");render();updateInvestments();
});
if($("refreshInvestments"))$("refreshInvestments").onclick=()=>{ $("status").textContent="Güncelleniyor..."; updateInvestments(); };


load();
applyTheme();
render();
startInvestmentRefresh();
})();