(() => {
"use strict";

const KEY="ailefinans_v41";
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
  try{
    for(const key of [KEY,"ailefinans_v41","ailefinans_v40","ailefinans_v39","ailefinans_v38","ailefinans_v37","ailefinans_v36","ailefinans_v24"]){
      raw=localStorage.getItem(key);
      if(raw)break;
    }
  }catch(e){}
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
  // Normalize older member formats so old data remains visible and selectable.
  db.members=db.members.map(m=>typeof m==="string"?m:(m?.name||m?.fullName||m?.title||"")).map(String).filter(Boolean);
  db.settings={appName:"Aile Finans",currency:"TRY",theme:"system",...(db.settings||{})};
}
  db.bills=Array.isArray(db.bills)?db.bills:[];

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
  const status=x.manualPriceAt?`<span class="live-dot"></span> Manuel ${new Date(x.manualPriceAt).toLocaleDateString("tr-TR")}`:`<span class="muted">Manuel fiyat bekleniyor</span>`;
  const history=Array.isArray(x.priceHistory)?x.priceHistory.slice(-3).reverse():[];
  const historyHtml=history.length?`<div class="price-history">${history.map(h=>`<small>${escapeHtml(h.date)} · ${money(Number(h.price)||0,c)}${h.note?` · ${escapeHtml(h.note)}`:""}</small>`).join("")}</div>`:"";
  return `<div class="item investment-card"><span><b>${escapeHtml(x.name)}</b><br><span class="muted">${investmentTypeLabel[x.type]||"Diğer"} · ${qty}${x.type==="gold"?" g":""}</span><br><small class="live-status">${status}${history.length?` · ${x.priceHistory.length} kayıt`:""}</small>${historyHtml}</span><span class="investment-value"><b>${value==null?"—":money(value,c)}</b><br>${change}<br><button data-manual-price="${x.id}">Fiyat Gir</button></span></div>`;
}
function billStatus(b){
  if(b.paid)return "paid";
  const d=new Date((b.dueDate||"")+"T00:00:00"),todayDate=new Date();todayDate.setHours(0,0,0,0);
  if(Number.isNaN(d.getTime()))return "unknown";
  const diff=Math.ceil((d-todayDate)/86400000);
  return diff<0?"overdue":diff<=3?"soon":"pending";
}
function billNextDate(b){
  if(!b.recurring)return b.dueDate||"";
  const d=new Date((b.dueDate||"")+"T00:00:00"),todayDate=new Date();todayDate.setHours(0,0,0,0);
  if(Number.isNaN(d.getTime()))return b.dueDate||"";
  while(d<todayDate){if(b.period==="weekly")d.setDate(d.getDate()+7);else if(b.period==="yearly")d.setFullYear(d.getFullYear()+1);else d.setMonth(d.getMonth()+1)}
  return d.toISOString().slice(0,10);
}
function renderBills(){
  const box=$("billsList");if(!box)return;
  const bills=[...(db.bills||[])].sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||"")));
  if(!bills.length){box.innerHTML='<div class="empty">Henüz fatura eklenmedi.</div>';return}
  const labels={paid:"Ödendi",overdue:"Gecikti",soon:"Yaklaşıyor",pending:"Bekliyor",unknown:"Tarih yok"};
  box.innerHTML=bills.map(b=>`<div class="list-row bill-row">
    <div><b>${esc(b.name||"Fatura")}</b><small>${esc(b.category||"Diğer")} · Son ödeme: ${esc(billNextDate(b)||"-")}${b.recurring?" · Tekrarlı":""}</small></div>
    <strong>${money(Number(b.amount)||0,b.currency||"TRY")}</strong><span class="status-pill ${billStatus(b)}">${labels[billStatus(b)]}</span>
    <div class="row-actions">${!b.paid?`<button data-bill-pay="${b.id}">Ödendi</button>`:""}<button data-bill-edit="${b.id}">Düzenle</button><button class="danger" data-bill-delete="${b.id}">Sil</button></div>
  </div>`).join("");
  box.querySelectorAll("[data-bill-pay]").forEach(btn=>btn.onclick=()=>{const b=db.bills.find(x=>x.id===btn.dataset.billPay);if(b){b.paid=true;b.paidAt=new Date().toISOString();save();render()}});
  box.querySelectorAll("[data-bill-delete]").forEach(btn=>btn.onclick=()=>{if(confirm("Bu faturayı silmek istediğine emin misin?")){db.bills=db.bills.filter(x=>x.id!==btn.dataset.billDelete);save();render()}});
  box.querySelectorAll("[data-bill-edit]").forEach(btn=>btn.onclick=()=>{const b=db.bills.find(x=>x.id===btn.dataset.billEdit);if(!b)return;$("billId").value=b.id;$("billName").value=b.name||"";$("billCategory").value=b.category||"Diğer";$("billAmount").value=b.amount||"";$("billCurrency").value=b.currency||"TRY";$("billDueDate").value=b.dueDate||"";$("billRecurring").checked=!!b.recurring;$("billPeriod").value=b.period||"monthly";openModal("billModal")});
}
function renderBillSummary(){
  const pending=(db.bills||[]).filter(x=>!x.paid);
  if($("billTotal"))$("billTotal").textContent=money(pending.reduce((s,x)=>s+(Number(x.amount)||0),0),"TRY");
  if($("billOverdue"))$("billOverdue").textContent=money(pending.filter(x=>billStatus(x)==="overdue").reduce((s,x)=>s+(Number(x.amount)||0),0),"TRY");
  if($("billCount"))$("billCount").textContent=String(pending.length);
}

function render(){
  renderTodayHistory();
  renderBills();renderBillSummary();
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


function availableReportMonths(){
  const set=new Set();
  const add=a=>(a||[]).forEach(x=>{const d=String(x.date||x.dueDate||"").slice(0,7);if(/^\d{4}-\d{2}$/.test(d))set.add(d)});
  add(db.incomes);add(db.expenses);add(db.vehicleFuelLogs);add(db.vehicleServices);add(db.vehicleDocuments);add(db.bills);
  const now=new Date();set.add(now.toISOString().slice(0,7));
  return [...set].sort().reverse();
}
function monthLabel(ym){
  const [y,m]=String(ym).split("-").map(Number);return y&&m?new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date(y,m-1,1)):"Ay";
}
function renderReport(){
  const selected=$('reportMember')?.value||"";
  const monthSelect=$('reportMonth');
  const currentMonth=monthSelect?.value||new Date().toISOString().slice(0,7);
  if($('reportMember')){
    $('reportMember').innerHTML='<option value="">Genel</option>'+db.members.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    $('reportMember').value=db.members.includes(selected)?selected:"";
  }
  const months=availableReportMonths();
  if(monthSelect){
    monthSelect.innerHTML=months.map(m=>`<option value="${m}">${escapeHtml(monthLabel(m))}</option>`).join('');
    monthSelect.value=months.includes(currentMonth)?currentMonth:months[0];
  }
  const ym=monthSelect?.value||currentMonth;
  const filter=x=>!selected || String(x.member||"")===selected;
  const incomes=(db.incomes||[]).filter(x=>String(x.date||"").slice(0,7)===ym&&filter(x));
  const expenses=(db.expenses||[]).filter(x=>String(x.date||"").slice(0,7)===ym&&filter(x));
  const income=incomes.reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const net=income-expense;
  const cats={}; expenses.forEach(x=>cats[x.category||"Diğer"]=(cats[x.category||"Diğer"]||0)+Number(x.amount||0));
  const inv=(db.investments||[]).reduce((s,x)=>s+(Number(x.livePrice)>0?Number(x.livePrice)*Number(x.quantity||0):0),0);
  const fuel=(db.vehicleFuelLogs||[]).filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+Number(x.total||0),0);
  const service=(db.vehicleServices||[]).filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+Number(x.cost||0),0);
  const title=selected?`${escapeHtml(selected)} · ${escapeHtml(monthLabel(ym))}`:escapeHtml(monthLabel(ym));
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div class="report-row"><span>${escapeHtml(k)}</span><b>${money(v,"TRY")}</b></div>`).join("")||'<div class="empty">Bu ay harcama yok.</div>';
  const archive=months.map(m=>{
    const mi=(db.incomes||[]).filter(x=>String(x.date||"").slice(0,7)===m&&filter(x)).reduce((s,x)=>s+Number(x.amount||0),0);
    const me=(db.expenses||[]).filter(x=>String(x.date||"").slice(0,7)===m&&filter(x)).reduce((s,x)=>s+Number(x.amount||0),0);
    return `<button class="month-archive ${m===ym?'active':''}" data-report-month="${m}"><span>${escapeHtml(monthLabel(m))}</span><b>${money(mi-me,"TRY")}</b><small>Gelir ${money(mi,"TRY")} · Gider ${money(me,"TRY")}</small></button>`;
  }).join('');
  $('reportText').innerHTML=`
    <div class="report-hero"><div><small>${title}</small><h3>${selected?'Kişi Özeti':'Genel Finans Özeti'}</h3><div class="report-big ${net>=0?'gain':'loss'}">${net>=0?'+':''}${money(net,"TRY")}</div></div><span class="report-icon">₺</span></div>
    <div class="report-grid"><div class="report-card"><small>Gelir</small><b>${money(income,"TRY")}</b><span>${incomes.length} işlem</span></div><div class="report-card"><small>Gider</small><b>${money(expense,"TRY")}</b><span>${expenses.length} işlem</span></div><div class="report-card"><small>Yatırım Değeri</small><b>${money(inv,"TRY")}</b><span>${db.investments.length} yatırım</span></div><div class="report-card"><small>Araç Gideri</small><b>${money(selected?0:fuel+service,"TRY")}</b><span>${selected?'Genel araç gideri':'Yakıt + bakım'}</span></div></div>
    <div class="report-columns"><div class="panel"><h3>Harcama Dağılımı</h3>${catRows}</div><div class="panel"><h3>${selected?'Seçili Kişi':'Genel'} Özeti</h3><div class="report-row"><span>Toplam hesap bakiyesi</span><b>${money(db.accounts.reduce((s,a)=>s+Number(a.balance||0),0),"TRY")}</b></div><div class="report-row"><span>Üye</span><b>${selected?escapeHtml(selected):db.members.length+' kişi'}</b></div><div class="report-row"><span>Araç</span><b>${db.vehicles.length}</b></div><div class="report-row"><span>Yatırım</span><b>${db.investments.length}</b></div></div></div>
    <div class="panel month-archive-panel"><h3>Aylık Arşiv</h3><p class="muted">Önceki ayların kayıtları burada ayrı ayrı tutulur. Ay seçerek raporu açabilirsin.</p><div class="month-archive-grid">${archive}</div></div>`;
  document.querySelectorAll('[data-report-month]').forEach(b=>b.onclick=()=>{if(monthSelect){monthSelect.value=b.dataset.reportMonth;renderReport()}});
}
function renderSettings(){
  const s=db.settings||{};
  $("settingAppName").value=s.appName||"Aile Finans";
  $("settingCurrency").value=s.currency||"TRY";
  $("settingTheme").value=s.theme||"system";
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
  db.expenseCategories=$("settingCategories").value.split(",").map(x=>x.trim()).filter(Boolean);
  save();applyTheme();render();closeModal("settingsModal");toast("Ayarlar kaydedildi");
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
    db={...db,...x};db.settings={appName:"Aile Finans",currency:"TRY",theme:"system",...(x.settings||{})};save();applyTheme();render();toast("Yedek yüklendi");
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
const esc=escapeHtml;
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
  if(name==="reports")renderReport();
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  document.querySelectorAll("#sideNav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  window.scrollTo(0,0);
}
$("sideNav").addEventListener("click",e=>{
  const b=e.target.closest("button[data-page]"); if(!b)return;
  e.preventDefault(); page(b.dataset.page);
});

if($("reportMember"))$("reportMember").addEventListener("change",()=>renderReport());
if($("reportMonth"))$("reportMonth").addEventListener("change",()=>renderReport());

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
  const fuelLiters=fuels.reduce((s,x)=>s+(Number(x.liters)||0),0);
  const lastFuel=fuels[0];
  const avgFuelPrice=fuelLiters?fuelCost/fuelLiters:0;
  const nextService=services.map(x=>Number(x.nextKm)||0).filter(Boolean).sort((a,b)=>a-b)[0]||0;
  $("vehicleDetailSummary").innerHTML=`<div class="vehicle-summary-grid"><div><small>Araç</small><b>${escapeHtml(v.name)}</b><span>${escapeHtml(v.plate||"Plaka yok")}</span></div><div><small>Kilometre</small><b>${vehicleKm(v).toLocaleString("tr-TR")} km</b><span>${nextService?`Sonraki bakım: ${nextService.toLocaleString("tr-TR")} km`:"Bakım planı yok"}</span></div><div><small>Yakıt</small><b>${money(fuelCost,"TRY")}</b><span>${fuelLiters.toFixed(1)} L · ort. ${avgFuelPrice?money(avgFuelPrice,"TRY/L"):"-"}</span></div><div><small>Bakım</small><b>${money(serviceCost,"TRY")}</b><span>${services.length} kayıt${lastFuel?` · son yakıt ${lastFuel.date}`:""}</span></div></div>`;
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
function fuelUnitPrice(total,liters){const t=Number(total)||0,l=Number(liters)||0;return l>0?t/l:0;}
function updateFuelUnitPrice(){const liters=Number($("vehicleFuelLiters").value)||0,total=Number($("vehicleFuelTotal").value)||0;const p=fuelUnitPrice(total,liters);$("vehicleFuelPrice").value=p?p.toFixed(2):"";}
$("vehicleFuelLiters").addEventListener("input",updateFuelUnitPrice);
$("vehicleFuelTotal").addEventListener("input",updateFuelUnitPrice);
$("vehicleFuelForm").addEventListener("submit",async e=>{
  e.preventDefault();const v=vehicleById(activeVehicleId),liters=Number($("vehicleFuelLiters").value),total=Number($("vehicleFuelTotal").value),price=fuelUnitPrice(total,liters),km=Number($("vehicleFuelKm").value);if(!v||liters<=0||price<=0||total<0||km<0)return;
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
  if(!title || !Number.isFinite(amount) || amount<=0){toast("Harcama adı ve tutarı girilmelidir");return;}
  const accountId=$("expenseAccount").value||"";
  const account=db.accounts.find(x=>x.id===accountId);
  const photo=await fileToDataUrl($("expensePhoto").files[0]);
  const currency=$("expenseCurrency").value||"TRY";
  db.expenses.push({id:uid(),title,amount,currency,member:$("expenseMember").value||"",category:$("expenseCategory").value||"Diğer",accountId,payment:account?account.name:"",date:$("expenseDate").value||today(),note:$("expenseNote").value.trim(),photo});
  if(account && account.currency===currency)account.balance-=amount;
  if(!save()){toast("Harcama kaydedilemedi");return;}
  $("expenseForm").reset();closeModal("expenseModal");render();toast("Harcama kaydedildi");
});

$("addInvestment").onclick=()=>{ $("investmentForm").reset(); $("investmentBuyDate").value=new Date().toISOString().slice(0,10); openModal("investmentModal"); };
$("investmentForm").addEventListener("submit",e=>{
  e.preventDefault();
  const qty=Number($("investmentQuantity").value), buy=Number($("investmentBuyPrice").value)||0;
  if(!Number.isFinite(qty)||qty<=0)return;
  db.investments.push({id:uid(),type:$("investmentType").value,name:$("investmentName").value.trim(),symbol:$("investmentSymbol").value.trim(),quantity:qty,buyPrice:buy,currency:$("investmentCurrency").value,buyDate:$("investmentBuyDate").value,note:$("investmentNote").value.trim(),livePrice:0,liveUpdatedAt:0});
  save();closeModal("investmentModal");render();page("investments");toast("Yatırım kaydedildi");
});


// Investment type helper
const invType=$("investmentType");
if(invType){
  const updateInvestmentHelp=()=>{
    const t=invType.value,el=$("investmentHelp");if(!el)return;
    el.textContent=t==="gold"?"Kod gerekmez · gram altın":t==="currency"?"Örn: USD/TRY veya USD":t==="crypto"?"CoinGecko ID: bitcoin, ethereum, tether":t==="stock"?"Borsa sembolü: AAPL, MSFT, THYAO.IS vb.":"Fon/borsa sembolü";
  };
  invType.addEventListener("change",updateInvestmentHelp);updateInvestmentHelp();
}
// Manual investment price history
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-manual-price]");if(!b)return;
  const x=(db.investments||[]).find(i=>i.id===b.dataset.manualPrice);if(!x)return;
  $("manualPriceId").value=x.id;$("manualPriceValue").value=x.livePrice||x.buyPrice||"";
  $("manualPriceDate").value=today();$("manualPriceNote").value="";openModal("manualPriceModal");
});
if($("manualPriceForm"))$("manualPriceForm").addEventListener("submit",e=>{
  e.preventDefault();
  const x=(db.investments||[]).find(i=>i.id===$("manualPriceId").value),p=Number($("manualPriceValue").value);
  if(!x||!(p>0))return;
  x.priceHistory=Array.isArray(x.priceHistory)?x.priceHistory:[];
  x.priceHistory.push({id:uid(),price:p,date:$("manualPriceDate").value||today(),note:$("manualPriceNote").value.trim()});
  x.livePrice=p;x.manualPriceAt=new Date(($("manualPriceDate").value||today())+"T12:00:00").toISOString();x.liveUpdatedAt=0;
  save();closeModal("manualPriceModal");render();
});
// Bills
if($("billForm"))$("billForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("billName").value.trim(),amount=Number($("billAmount").value)||0;
  if(!name||amount<=0){toast("Fatura adı ve tutarı girilmelidir");return;}
  const id=$("billId").value||uid(),old=db.bills.findIndex(x=>x.id===id);
  const item={id,name,category:$("billCategory").value||"Diğer",amount,currency:$("billCurrency").value||"TRY",dueDate:$("billDueDate").value||today(),recurring:!!$("billRecurring").checked,period:$("billPeriod").value||"monthly",paid:old>=0?!!db.bills[old].paid:false};
  if(old>=0)db.bills[old]=item;else db.bills.push(item);
  if(!save()){toast("Fatura kaydedilemedi");return;}
  $("billForm").reset();$("billCurrency").value="TRY";$("billPeriod").value="monthly";closeModal("billModal");render();toast("Fatura kaydedildi");
});
if($("addBill"))$("addBill").onclick=()=>{$("billId").value="";$('billForm').reset();$('billDueDate').value=today();$('billCurrency').value="TRY";$('billPeriod').value="monthly";openModal("billModal")};
// Today's historical notes
const historicalEvents={"01-01":["🎉 Yeni yılın ilk günü.","📅 Yeni bir yılın başlangıcı; finans planını ve hedeflerini gözden geçirmek için iyi bir takvim noktası."],"02-04":["🌍 Dünya Kanser Günü.","🗓️ Sağlık farkındalığı ve erken teşhis konusunda küresel farkındalık günü."],"02-14":["❤️ Sevgililer Günü.","💡 Hediye ve sosyal harcamaları bütçede ayrıca takip etmek için güzel bir gün."],"02-21":["🌐 Uluslararası Anadil Günü."],"03-08":["🌍 Dünya Kadınlar Günü."],"03-18":["🇹🇷 Çanakkale Deniz Zaferi ve Şehitleri Anma Günü."],"03-21":["🌱 Nevruz ve baharın başlangıcı dönemi.","🌞 Kuzey Yarımküre’de mevsimsel geçiş dönemi."],"04-23":["🇹🇷 Ulusal Egemenlik ve Çocuk Bayramı.","🏛️ Türkiye Büyük Millet Meclisinin açılışının yıl dönümü."],"05-01":["🛠️ Emek ve Dayanışma Günü."],"05-19":["🇹🇷 Atatürk’ü Anma, Gençlik ve Spor Bayramı."],"06-05":["🌿 Dünya Çevre Günü.","♻️ Çevre ve sürdürülebilirlik farkındalığı için küresel gün."],"07-15":["🇹🇷 Demokrasi ve Millî Birlik Günü."],"08-30":["🇹🇷 Zafer Bayramı."],"09-23":["🌗 Eylül ekinoksu dönemi.","🍂 Kuzey Yarımküre’de astronomik sonbaharın başlangıcı civarı.","☀️ Ekinoks döneminde gece ve gündüz süreleri birbirine yaklaşır.","📊 Bugün ayrıca yıllık bütçe hedeflerini yılın son çeyreğine göre kontrol etmek için iyi bir takvim noktası."],"10-29":["🇹🇷 Cumhuriyet Bayramı."],"11-10":["🇹🇷 Türkiye’de Mustafa Kemal Atatürk’ü anma günü."],"11-20":["🌍 Dünya Çocuk Hakları Günü."],"12-03":["🌍 Dünya Engelliler Günü."],"12-10":["🌍 İnsan Hakları Günü."],"12-21":["❄️ Aralık gündönümü dönemi; Kuzey Yarımküre’de kış başlangıcı civarı."],"12-31":["🎆 Yılın son günü.","📊 Yıl sonu gelir-gider ve yatırım performansını kapatmak için iyi bir kontrol noktası."]};
function renderTodayHistory(){
  const box=$("dailyHistory");if(!box)return;const d=new Date(),key=String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const events=historicalEvents[key]||["Bugün için uygulamadaki kısa tarih notu bulunmuyor.","Takvimde yeni bir gün. İnsanlık hâlâ günleri sayıyor, teknoloji şimdilik ilerliyor."];
  if($("dailyHistoryTitle"))$("dailyHistoryTitle").textContent=`${d.toLocaleDateString("tr-TR",{day:"numeric",month:"long"})} · Bugünün Tarihi`;
  box.innerHTML=events.map((x,i)=>`<div class="history-event"><span>${i?"•":"📅"}</span><div>${escapeHtml(x)}</div></div>`).join("");
}

const menuToggle=$("menuToggle"),menuOverlay=$("menuOverlay");
function setMenu(open){document.body.classList.toggle("menu-open",!!open);if(menuToggle)menuToggle.setAttribute("aria-expanded",open?"true":"false");}
if(menuToggle)menuToggle.onclick=()=>setMenu(!document.body.classList.contains("menu-open"));
if(menuOverlay)menuOverlay.onclick=()=>setMenu(false);
document.addEventListener("click",e=>{if(e.target.closest("#sideNav button[data-page]"))setMenu(false);});
load();
applyTheme();
page("home");
render();

})();

