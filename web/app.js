const KEY="ailefinans_v11";
const VERSION_OLD_KEYS=["ailefinans_v10","ailefinans_v9","ailefinans_v8","ailefinans_v7","ailefinans_v6","ailefinans_v5","ailefinans_v4","ailefinans_v3","ailefinans_v2"];
const OLD_KEYS=["ailefinans_v3","ailefinans_v2"];
const $=id=>document.getElementById(id);
let editAccountId=null;

function uid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}
function money(n,c="TRY"){return new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0)+" "+c}
function today(){return new Date().toISOString().slice(0,10)}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove("show"),1800)}
function openModal(id){$(id).classList.add("open")}
function closeModal(id){$(id).classList.remove("open")}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function normalizeAccount(a){
  return {id:a.id||uid(),name:String(a.name||"").trim(),type:a.type||"Diğer",balance:Number(a.balance)||0,currency:a.currency||"TRY"}
}
function load(){
  let raw=localStorage.getItem(KEY);
  if(!raw){
    for(const k of VERSION_OLD_KEYS){const x=localStorage.getItem(k);if(x){raw=x;break}}
  }
  let x={};
  try{x=raw?JSON.parse(raw):{}}catch(e){}
  db={
    members:Array.isArray(x.members)&&x.members.length?x.members:["Sebahattin","Eşim"],
    accounts:Array.isArray(x.accounts)?x.accounts.map(normalizeAccount):[],
    expenses:Array.isArray(x.expenses)?x.expenses:[],
    income:Array.isArray(x.income)?x.income:[],
    transfers:Array.isArray(x.transfers)?x.transfers:[],
    debts:Array.isArray(x.debts)?x.debts:[],
    vehicles:Array.isArray(x.vehicles)?x.vehicles:[],
    vehicleReminders:Array.isArray(x.vehicleReminders)?x.vehicleReminders:[],
    bills:Array.isArray(x.bills)?x.bills:[],
    investments:Array.isArray(x.investments)?x.investments:[],
    investmentTransactions:Array.isArray(x.investmentTransactions)?x.investmentTransactions:[]
  };
  db.debts=db.debts.map(x=>({...x,id:x.id||uid(),type:x.type||"debt",paid:Number(x.paid)||0,payments:Array.isArray(x.payments)?x.payments:[]}));
  db.income=db.income.map(x=>({...x,id:x.id||uid(),type:"income"}));
  db.vehicleLogs=Array.isArray(x.vehicleLogs)?x.vehicleLogs:[];
  db.expenses=db.expenses.map(x=>({...x,id:x.id||uid(),type:"expense"}));
  db.transfers=db.transfers.map(x=>({...x,id:x.id||uid(),type:"transfer"}));
  if(!db.accounts.length){
    db.accounts=[
      {id:uid(),name:"Nakit",type:"Nakit",balance:0,currency:"TRY"},
      {id:uid(),name:"Banka Kartı",type:"Banka",balance:0,currency:"TRY"},
      {id:uid(),name:"Kredi Kartı",type:"Kredi Kartı",balance:0,currency:"TRY"}
    ];
  }
  localStorage.setItem(KEY,JSON.stringify(db));
}
let db={members:[],accounts:[],expenses:[],income:[],transfers:[],debts:[],vehicles:[]};
let vehicleFilter=null;
let billFilter="all";
let investmentFilter="all";
let debtFilter="all";

function render(){
  $("accountCount").textContent=db.accounts.length;
  const inc=db.income.reduce((s,x)=>s+Number(x.amount||0),0);
  const exp=db.expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  $("incomeTotal").textContent=money(inc);
  $("expenseTotal").textContent=money(exp);

  $("accountList").innerHTML=db.accounts.length?db.accounts.map(a=>`
    <div class="item">
      <div class="item-main"><button class="account-open" data-detail="${a.id}"><div class="item-title">${esc(a.name)}</div><div class="item-sub">${esc(a.type)} · ${a.currency}</div></button>
      <div class="item-right"><div class="amount">${money(a.balance,a.currency)}</div>
        <div class="actions"><button class="icon-btn" data-edit="${a.id}">Düzenle</button><button class="icon-btn danger" data-delete="${a.id}">Sil</button></div>
      </div>
    </div>`).join(""):`<div class="empty">Henüz hesap veya kart yok.</div>`;

  $("memberList").innerHTML=db.members.map((m,i)=>`<div class="item"><div>${esc(m)}</div>${i>1?`<button class="icon-btn danger" data-member-delete="${i}">Sil</button>`:""}</div>`).join("");

  const opts=db.accounts.map(a=>`<option value="${escAttr(a.name)}">${esc(a.name)} · ${a.currency}</option>`).join("");
  $("incomeAccount").innerHTML=opts||`<option value="">Önce hesap ekle</option>`;
  $("expensePayment").innerHTML=opts||`<option value="">Önce hesap ekle</option>`;
  const transferOpts=db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  $("transferFrom").innerHTML=transferOpts;
  $("transferTo").innerHTML=transferOpts;
  $("expenseMember").innerHTML=db.members.map(m=>`<option>${esc(m)}</option>`).join("");

  const debtRows=db.debts.filter(d=>debtFilter==="all"||d.type===debtFilter).slice().reverse();
  const debtTotal=debtRows.filter(d=>d.type==="debt").reduce((s,d)=>s+Math.max(0,d.amount-d.paid),0);
  const receivableTotal=debtRows.filter(d=>d.type==="receivable").reduce((s,d)=>s+Math.max(0,d.amount-d.paid),0);

const MARKET_API="https://tlcevir.com/api/rates";
let marketRates={};
let marketLastUpdated=null;

async function fetchMarketRates(){
  try{
    const res=await fetch(MARKET_API,{cache:"no-store"});
    if(!res.ok) throw new Error("market");
    const data=await res.json();
    marketRates=data.rates||data.data||data;
    marketLastUpdated=new Date();
    return true;
  }catch(e){
    console.warn("Piyasa verisi alınamadı",e);
    return false;
  }
}
function normalizeSymbol(s){return String(s||"").trim().toUpperCase().replace(/[-\s]/g,"_")}
function findRate(symbol){
  const key=normalizeSymbol(symbol);
  const candidates=[key,key.replace("_TRY",""),key.replace("TRY_",""),key==="XAU_GRAM"?"GRAMALTIN":key,key==="GOLD"?"XAU_GRAM":key];
  for(const c of candidates){
    const v=marketRates[c];
    if(typeof v==="number")return v;
    if(v&&typeof v==="object"){
      const n=Number(v.satis??v.sell??v.ask??v.price??v.rate);
      if(Number.isFinite(n))return n;
    }
  }
  return null;
}
function autoValueForInvestment(i){
  if(i.auto!=="auto"||!i.symbol)return null;
  const rate=findRate(i.symbol);
  if(rate==null)return null;
  // TRY-denominated quantity assets such as gram gold use rate directly.
  if(i.currency==="TRY") return Number(i.qty)*rate;
  // For foreign currency assets, API rate is assumed to be TRY per unit when symbol is USD/EUR/GBP.
  return Number(i.qty)*rate;
}
async function refreshInvestments(){
  const ok=await fetchMarketRates();
  let changed=0;
  if(ok){
    db.investments.forEach(i=>{
      const val=autoValueForInvestment(i);
      if(val!=null){i.value=val;i.livePrice=val/Number(i.qty||1);i.liveUpdated=new Date().toISOString();changed++}
    });
    save();render();
  }
  toast(ok?`${changed} yatırım güncellendi`:"Piyasa verisi alınamadı, son değerler korundu");
}
  const invs=db.investments.filter(i=>investmentFilter==="all"||(investmentFilter==="open"?i.status!=="closed":i.status==="closed"));
  const investedCost=invs.reduce((s,i)=>s+Number(i.cost||0),0);
  const currentValue=invs.reduce((s,i)=>s+Number(i.value||0),0);
  const pnl=currentValue-investedCost;
  $("investmentSummary").innerHTML=`<div class="stat"><span>Maliyet</span><strong>${money(investedCost)}</strong></div><div class="stat"><span>Güncel Değer</span><strong>${money(currentValue)}</strong></div><div class="stat"><span>Kâr / Zarar</span><strong>${money(pnl)}</strong></div>`;
  $("investmentList").innerHTML=invs.length?invs.map(i=>{
    const live=autoValueForInvestment(i); if(live!=null)i.value=live;
    const diff=Number(i.value||0)-Number(i.cost||0),pct=Number(i.cost)?(diff/i.cost*100):0;
    const liveText=live!=null?` · Canlı ${money(i.livePrice,i.currency)}`:"";
    return `<div class="item"><div><div class="item-title">📈 ${esc(i.name)} · ${esc(i.type)}</div><div class="item-sub">${Number(i.qty).toLocaleString("tr-TR")} · ${esc(i.currency)} · ${esc(i.date)}${liveText} · ${i.status==="closed"?"Kapalı":"Açık"}</div></div><div class="item-right"><div class="amount">${money(i.value,i.currency)}</div><div class="item-sub">${diff>=0?"+":""}${money(diff,i.currency)} (${pct.toFixed(2)}%)</div><div class="actions"><button class="icon-btn" data-invest-tx="${i.id}">İşlem</button><button class="icon-btn" data-edit-invest="${i.id}">Düzenle</button><button class="icon-btn danger" data-delete-invest="${i.id}">Sil</button></div></div></div>`;
  }).join(""):`<div class="empty">Bu filtrede yatırım yok.</div>`;

  const bills=db.bills.filter(b=>billFilter==="all"||(billFilter==="paid"?b.paid:b.status!=="paid")).slice().sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const unpaid=bills.filter(b=>b.status!=="paid").reduce((s,b)=>s+Number(b.amount||0),0);
  const overdue=bills.filter(b=>b.status!=="paid"&&b.dueDate<new Date().toISOString().slice(0,10)).length;
  $("billSummary").innerHTML=`<div class="stat"><span>Ödenecek</span><strong>${money(unpaid)}</strong></div><div class="stat"><span>Geciken</span><strong>${overdue}</strong></div><div class="stat"><span>Fatura</span><strong>${bills.length}</strong></div>`;
  $("billList").innerHTML=bills.length?bills.map(b=>{
    const days=Math.ceil((new Date(b.dueDate)-new Date())/86400000);
    const state=b.status==="paid"?"🟢 Ödendi":days<0?"🔴 Gecikmiş":days<=7?"🟡 Yaklaşıyor":"⚪ Bekliyor";
    return `<div class="item"><div><div class="item-title">🧾 ${esc(b.type)} · ${esc(b.provider)}</div><div class="item-sub">${state} · Son ödeme ${esc(b.dueDate)}${b.note?" · "+esc(b.note):""}</div></div><div class="item-right"><div class="amount">${money(b.amount,b.currency)}</div><div class="actions">${b.status!=="paid"?`<button class="icon-btn" data-pay-bill="${b.id}">Öde</button>`:""}<button class="icon-btn" data-edit-bill="${b.id}">Düzenle</button><button class="icon-btn danger" data-delete-bill="${b.id}">Sil</button></div></div></div>`;
  }).join(""):`<div class="empty">Bu filtrede fatura yok.</div>`;

  $("vehicleReminderList").innerHTML=db.vehicleReminders.length?db.vehicleReminders.map(r=>{
    const v=db.vehicles.find(x=>x.id===r.vehicleId); if(!v)return "";
    const days=Math.ceil((new Date(r.dueDate)-new Date())/86400000);
    const state=days<0?"🔴 Geçti":days<=30?"🟡 Yaklaşıyor":"🟢 Planlı";
    return `<div class="item"><div><div class="item-title">${esc(v.make)} ${esc(v.model)} · ${esc(r.type)}</div><div class="item-sub">${state} · ${esc(r.dueDate)}</div></div><button class="icon-btn danger" data-delete-reminder="${r.id}">Sil</button></div>`;
  }).join(""):`<div class="empty">Yaklaşan araç işlemi yok.</div>`;

  $("vehicleList").innerHTML=db.vehicles.length?db.vehicles.map(v=>{
    const logs=db.vehicleLogs.filter(l=>l.vehicleId===v.id);
    const latestKm=logs.filter(l=>Number(l.km)>=0).sort((a,b)=>Number(b.km)-Number(a.km))[0]?.km;
    const km=latestKm!==undefined?latestKm:(v.km||0);
    return `<div class="item"><div class="item-main"><div class="item-title">🚗 ${esc(v.make)} ${esc(v.model)}</div><div class="item-sub">${esc(v.plate||"Plaka yok")} · ${esc(v.fuel)} · ${Number(km).toLocaleString("tr-TR")} km</div></div><div class="actions"><button class="icon-btn" data-vehicle-log="${v.id}">+ Kayıt</button><button class="icon-btn" data-add-reminder="${v.id}">🔔</button><button class="icon-btn" data-edit-vehicle="${v.id}">Düzenle</button><button class="icon-btn danger" data-delete-vehicle="${v.id}">Sil</button></div></div>`;
  }).join(""):`<div class="empty">Henüz araç eklenmedi.</div>`;

  $("debtSummary").innerHTML=`<div class="stat"><span>Ödenecek</span><strong>${money(debtTotal)}</strong></div><div class="stat"><span>Alınacak</span><strong>${money(receivableTotal)}</strong></div><div class="stat"><span>Kayıt</span><strong>${debtRows.length}</strong></div>`;
  $("debtList").innerHTML=debtRows.length?debtRows.map(d=>{
    const remain=Math.max(0,Number(d.amount)-Number(d.paid||0)), status=remain<=0?"Ödendi":(d.paid>0?"Kısmi ödendi":"Ödenmedi");
    const due=d.dueDate?` · Vade ${esc(d.dueDate)}`:"";
    return `<div class="item"><div class="item-main"><div class="item-title">${d.type==="debt"?"💳 Borç":"💰 Alacak"} · ${esc(d.person)}</div><div class="item-sub">${status}${due}</div></div><div class="item-right"><div class="amount">${money(remain,d.currency)}</div><div class="actions">${remain>0?`<button class="icon-btn" data-pay-debt="${d.id}">${d.type==="debt"?"Öde":"Tahsil Et"}</button>`:""}<button class="icon-btn" data-edit-debt="${d.id}">Düzenle</button><button class="icon-btn danger" data-delete-debt="${d.id}">Sil</button></div></div></div>`;
  }).join(""):`<div class="empty">Bu filtrede borç/alacak kaydı yok.</div>`;

  $("expenseList").innerHTML=db.expenses.length?db.expenses.slice().reverse().map(x=>`
    <div class="item"><div class="item-main"><div class="item-title">${esc(x.category||"Harcama")}</div><div class="item-sub">${esc(x.merchant||"")} · ${esc(x.member||"")} · ${esc(x.payment||"")}</div></div><div class="item-right"><div class="amount">-${money(x.amount,x.currency)}</div><div class="item-sub">${esc(x.date||"")}</div></div></div>`).join(""):`<div class="empty">Henüz harcama yok.</div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escAttr(s){return esc(s)}

function resetAccountForm(){
  $("accountForm").reset();$("accountId").value="";$("accountBalance").value="0";$("accountCurrency").value="TRY";$("accountModalTitle").textContent="Hesap / Kart Ekle";editAccountId=null;
}
function openAccount(){
  resetAccountForm();openModal("accountModal");setTimeout(()=>$("accountName").focus(),50)
}
function editAccount(id){
  const a=db.accounts.find(x=>x.id===id);if(!a)return;
  editAccountId=id;$("accountId").value=id;$("accountName").value=a.name;$("accountType").value=a.type;$("accountBalance").value=a.balance;$("accountCurrency").value=a.currency;$("accountModalTitle").textContent="Hesap / Kart Düzenle";openModal("accountModal");
}
function saveAccount(){
  const name=$("accountName").value.trim(),type=$("accountType").value,balance=Number($("accountBalance").value)||0,currency=$("accountCurrency").value;
  if(!name){toast("Hesap adı gerekli");$("accountName").focus();return}
  if(editAccountId){
    const a=db.accounts.find(x=>x.id===editAccountId);const old=a.name;
    a.name=name;a.type=type;a.balance=balance;a.currency=currency;
    db.expenses.forEach(x=>{if(x.payment===old)x.payment=name});db.income.forEach(x=>{if(x.account===old)x.account=name});
    save();closeModal("accountModal");toast("Hesap güncellendi");
  }else{
    db.accounts.push({id:uid(),name,type,balance,currency});
    save();closeModal("accountModal");toast("Hesap kaydedildi");
  }
}
function deleteAccount(id){
  const a=db.accounts.find(x=>x.id===id);if(!a)return;
  const used=db.expenses.filter(x=>x.payment===a.name).length+db.income.filter(x=>x.account===a.name).length;
  const msg=used?`"${a.name}" hesabı ${used} işlemde kullanılıyor. Hesabı silersen eski işlemler korunur ancak hesap bağlantısı kaldırılır. Silinsin mi?`:`"${a.name}" hesabı silinsin mi?`;
  if(!confirm(msg))return;
  db.accounts=db.accounts.filter(x=>x.id!==id);save();toast("Hesap silindi");
}

$("accountForm").addEventListener("submit",e=>{e.preventDefault();saveAccount()});
$("addAccountBtn").onclick=openAccount;
$("accountList").addEventListener("click",e=>{const ed=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(ed)editAccount(ed.dataset.edit);if(del)deleteAccount(del.dataset.delete)});
$("addMemberBtn").onclick=()=>{ $("memberForm").reset();openModal("memberModal") };
$("memberForm").onsubmit=e=>{e.preventDefault();const n=$("memberName").value.trim();if(n){db.members.push(n);save();closeModal("memberModal");toast("Üye eklendi")}};
$("memberList").addEventListener("click",e=>{const b=e.target.closest("[data-member-delete]");if(!b)return;const i=Number(b.dataset.memberDelete);if(confirm(`"${db.members[i]}" silinsin mi?`)){db.members.splice(i,1);save();toast("Üye silindi")}});
$("incomeTopBtn").onclick=()=>{$("incomeForm").reset();$("incomeDate").value=today();render();openModal("incomeModal")};
$("incomeForm").onsubmit=e=>{e.preventDefault();const amount=Number($("incomeAmount").value);const currency=$("incomeCurrency").value;const account=$("incomeAccount").value;if(!amount||!account){toast("Tutar ve hesap gerekli");return}const a=db.accounts.find(x=>x.name===account);db.income.push({amount,currency,source:$("incomeSource").value.trim(),date:$("incomeDate").value,note:$("incomeNote").value.trim(),account});if(a&&a.currency===currency)a.balance+=amount;save();closeModal("incomeModal");toast("Gelir kaydedildi")};
function openExpense(){ $("expenseForm").reset();$("expenseDate").value=today();render();openModal("expenseModal") }
$("expenseTopBtn").onclick=openExpense;$("expenseBtn2").onclick=openExpense;
$("expenseForm").onsubmit=e=>{e.preventDefault();const amount=Number($("expenseAmount").value),currency=$("expenseCurrency").value,payment=$("expensePayment").value;if(!amount||!payment){toast("Tutar ve ödeme hesabı gerekli");return}const a=db.accounts.find(x=>x.name===payment);db.expenses.push({amount,currency,category:$("expenseCategory").value.trim(),member:$("expenseMember").value,payment,date:$("expenseDate").value,merchant:$("expenseMerchant").value.trim(),note:$("expenseNote").value.trim()});if(a&&a.currency===currency)a.balance-=amount;save();closeModal("expenseModal");toast("Harcama kaydedildi")};


function openTransfer(){
  if(db.accounts.length<2){toast("Transfer için en az 2 hesap gerekli");return}
  $("transferForm").reset();$("transferDate").value=today();render();openModal("transferModal")
}
function saveTransfer(){
  const from=$("transferFrom").value,to=$("transferTo").value,amount=Number($("transferAmount").value);
  if(!from||!to||from===to||!amount||amount<=0){toast("Gönderen, alıcı ve tutarı kontrol et");return}
  const a=db.accounts.find(x=>x.id===from),b=db.accounts.find(x=>x.id===to);
  if(!a||!b){toast("Hesap bulunamadı");return}
  if(a.currency!==b.currency){toast("Şimdilik farklı para birimleri arasında transfer yapılamaz");return}
  a.balance-=amount;b.balance+=amount;
  db.transfers.push({id:uid(),type:"transfer",from,to,amount,currency:a.currency,date:$("transferDate").value,note:$("transferNote").value.trim()});
  save();closeModal("transferModal");toast("Transfer kaydedildi")
}
function openAccountDetail(id){
  const a=db.accounts.find(x=>x.id===id);if(!a)return;
  $("detailTitle").textContent=a.name+" · Hareketler";
  const rows=[];
  db.income.filter(x=>x.account===a.name).forEach(x=>rows.push({date:x.date||"",sort:x.date||"",title:x.source||"Gelir",sub:"Gelir",amount:Number(x.amount)||0}));
  db.expenses.filter(x=>x.payment===a.name).forEach(x=>rows.push({date:x.date||"",sort:x.date||"",title:x.category||"Harcama",sub:x.merchant||"Harcama",amount:-Number(x.amount||0)}));
  db.transfers.filter(x=>x.from===a.id||x.to===a.id).forEach(x=>{
    const other=db.accounts.find(y=>y.id===(x.from===a.id?x.to:x.from));
    rows.push({date:x.date||"",sort:x.date||"",title:x.from===a.id?"Transfer → "+(other?.name||"hesap"):"Transfer ← "+(other?.name||"hesap"),sub:"Transfer",amount:x.from===a.id?-Number(x.amount||0):Number(x.amount||0)});
  });
  rows.sort((x,y)=>String(y.sort).localeCompare(String(x.sort)));
  $("accountDetailBody").innerHTML=rows.length?rows.map(r=>`<div class="item"><div><div class="item-title">${esc(r.title)}</div><div class="item-sub">${esc(r.sub)} · ${esc(r.date)}</div></div><div class="amount">${r.amount>=0?"+":"-"}${money(Math.abs(r.amount),a.currency)}</div></div>`).join(""):`<div class="empty">Bu hesapta henüz hareket yok.</div>`;
  openModal("accountDetailModal")
}
$("addTransferBtn").onclick=openTransfer;
$("transferForm").onsubmit=e=>{e.preventDefault();saveTransfer()};
$("accountList").addEventListener("click",e=>{
  const d=e.target.closest("[data-detail]"),ed=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
  if(d&&!ed&&!del)openAccountDetail(d.dataset.detail);
});



function openVehicle(){
  $("vehicleForm").reset();$("vehicleId").value="";$("vehicleKm").value="0";$("vehicleModalTitle").textContent="Araç Ekle";openModal("vehicleModal")
}
function saveVehicle(){
  const id=$("vehicleId").value,data={make:$("vehicleMake").value.trim(),model:$("vehicleModel").value.trim(),year:Number($("vehicleYear").value)||"",plate:$("vehiclePlate").value.trim(),fuel:$("vehicleFuel").value,km:Number($("vehicleKm").value)||0};
  if(!data.make||!data.model){toast("Marka ve model gerekli");return}
  if(id){const v=db.vehicles.find(x=>x.id===id);Object.assign(v,data);toast("Araç güncellendi")}
  else{data.id=uid();db.vehicles.push(data);toast("Araç kaydedildi")}
  save();closeModal("vehicleModal")
}
function editVehicle(id){
  const v=db.vehicles.find(x=>x.id===id);if(!v)return;
  $("vehicleId").value=v.id;$("vehicleMake").value=v.make;$("vehicleModel").value=v.model;$("vehicleYear").value=v.year||"";$("vehiclePlate").value=v.plate||"";$("vehicleFuel").value=v.fuel||"Benzin";$("vehicleKm").value=v.km||0;$("vehicleModalTitle").textContent="Araç Düzenle";openModal("vehicleModal")
}
function openVehicleLog(id){
  const v=db.vehicles.find(x=>x.id===id);if(!v)return;
  $("vehicleLogForm").reset();$("vehicleLogId").value=id;$("vehicleLogDate").value=today();$("vehicleLogKm").value=v.km||0;
  $("vehiclePaymentAccount").innerHTML=db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  toggleVehicleFields();openModal("vehicleLogModal")
}
function toggleVehicleFields(){
  const type=$("vehicleLogType").value;
  $("fuelFields").style.display=type==="fuel"?"block":"none";
  $("costFields").style.display=type==="odometer"?"none":"block";
  $("vehicleCost").required=type!=="odometer";
  $("vehicleLogKm").required=true;
}
function saveVehicleLog(){
  const id=$("vehicleLogId").value,v=db.vehicles.find(x=>x.id===id),type=$("vehicleLogType").value,km=Number($("vehicleLogKm").value)||0,date=$("vehicleLogDate").value;
  if(!v)return;
  const liters=Number($("fuelLiters").value)||0;
  const log={id:uid(),vehicleId:id,type,km,date,desc:$("vehicleDesc").value.trim(),amount:Number($("vehicleCost").value)||0,currency:$("vehicleCurrency").value,accountId:$("vehiclePaymentAccount").value,liters,literPrice:0,station:$("fuelStation").value.trim()};
  if(type==="fuel"){
    if(!log.amount||!liters){toast("Yakıt için litre ve toplam tutar gerekli");return}
    log.literPrice=log.amount/liters;
  }
  if(type!=="odometer" && (!log.amount||!log.accountId)){toast("Tutar ve ödeme hesabı gerekli");return}
  if(log.amount){
    const a=db.accounts.find(x=>x.id===log.accountId);
    if(!a||a.currency!==log.currency){toast("Ödeme hesabı ile para birimi uyuşmuyor");return}
    a.balance-=log.amount;
    db.expenses.push({id:uid(),type:"expense",amount:log.amount,currency:log.currency,category:type==="fuel"?"Araç · Yakıt":type==="maintenance"?"Araç · Bakım":"Araç · Masraf",member:"",payment:a.name,date,merchant:type==="fuel"?(log.station||v.make+" "+v.model):v.make+" "+v.model,note:log.desc,vehicleId:id,vehicleLogId:log.id});
  }
  db.vehicleLogs.push(log);v.km=Math.max(Number(v.km)||0,km);save();closeModal("vehicleLogModal");toast("Araç kaydı kaydedildi")
}
$("addVehicleBtn").onclick=openVehicle;
$("vehiclesModuleBtn").onclick=()=>document.getElementById("vehiclesCard").scrollIntoView({behavior:"smooth"});
$("vehicleForm").onsubmit=e=>{e.preventDefault();saveVehicle()};
$("vehicleLogForm").onsubmit=e=>{e.preventDefault();saveVehicleLog()};
$("vehicleLogType").onchange=toggleVehicleFields;
$("vehicleList").addEventListener("click",e=>{
  const add=e.target.closest("[data-vehicle-log]"),ed=e.target.closest("[data-edit-vehicle]"),del=e.target.closest("[data-delete-vehicle]");
  if(add)openVehicleLog(add.dataset.vehicleLog);
  if(ed)editVehicle(ed.dataset.editVehicle);
  if(del){const v=db.vehicles.find(x=>x.id===del.dataset.deleteVehicle);if(v&&confirm(`${v.make} ${v.model} silinsin mi?`)){db.vehicles=db.vehicles.filter(x=>x.id!==v.id);db.vehicleLogs=db.vehicleLogs.filter(x=>x.vehicleId!==v.id);save();toast("Araç silindi")}}
});



function openInvestment(){
  $("investmentForm").reset();$("investmentId").value="";$("investmentModalTitle").textContent="Yatırım Ekle";$("investmentDate").value=today();$("investmentAuto").value="auto";$("investmentLivePrice").textContent="-";$("investmentLiveUpdated").textContent="Kaydetmeden önce fiyatı güncelleyebilirsin";
  $("investmentAccount").innerHTML=db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  openModal("investmentModal")
}
function saveInvestment(){
  const id=$("investmentId").value,data={type:$("investmentType").value,name:$("investmentName").value.trim(),currency:$("investmentCurrency").value,qty:Number($("investmentQty").value),cost:Number($("investmentCost").value),value:Number($("investmentValue").value),date:$("investmentDate").value,auto:$("investmentAuto").value,symbol:$("investmentSymbol").value.trim().toUpperCase(),accountId:$("investmentAccount").value,note:$("investmentNote").value.trim(),status:"open"};
  if(!data.name||!data.qty||data.cost<0||data.value<0||!data.date){toast("Yatırım bilgilerini kontrol et");return}
  if(id){const i=db.investments.find(x=>x.id===id);Object.assign(i,data);toast("Yatırım güncellendi")}
  else{
    data.id=uid();db.investments.push(data);
    if(data.cost>0){
      const a=db.accounts.find(x=>x.id===data.accountId);
      if(a&&a.currency===data.currency){a.balance-=data.cost;db.expenses.push({id:uid(),type:"expense",amount:data.cost,currency:data.currency,category:"Yatırım · Alım",member:"",payment:a.name,date:data.date,merchant:data.name,note:data.note,investmentId:data.id})}
    }
    toast("Yatırım kaydedildi")
  }
  save();closeModal("investmentModal")
}
function editInvestment(id){
  const i=db.investments.find(x=>x.id===id);if(!i)return;
  $("investmentId").value=i.id;$("investmentType").value=i.type;$("investmentName").value=i.name;$("investmentAuto").value=i.auto||"manual";$("investmentSymbol").value=i.symbol||"";$("investmentCurrency").value=i.currency;$("investmentQty").value=i.qty;$("investmentCost").value=i.cost;$("investmentValue").value=i.value;$("investmentDate").value=i.date;$("investmentAccount").innerHTML=db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");$("investmentAccount").value=i.accountId||"";$("investmentNote").value=i.note||"";$("investmentModalTitle").textContent="Yatırım Düzenle";openModal("investmentModal")
}
function openInvestmentTx(id){
  const i=db.investments.find(x=>x.id===id);if(!i)return;
  $("transactionInvestmentId").value=id;$("investmentTransactionAmount").value="";$("investmentTransactionDate").value=today();
  $("investmentTransactionAccount").innerHTML=db.accounts.filter(a=>a.currency===i.currency).map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  openModal("investmentTransactionModal")
}
function saveInvestmentTx(){
  const id=$("transactionInvestmentId").value,i=db.investments.find(x=>x.id===id),type=$("investmentTransactionType").value,amount=Number($("investmentTransactionAmount").value),date=$("investmentTransactionDate").value,accountId=$("investmentTransactionAccount").value;
  if(!i||!amount||!date){toast("İşlem bilgilerini kontrol et");return}
  const a=db.accounts.find(x=>x.id===accountId);
  if(!a||a.currency!==i.currency){toast("Para birimini kontrol et");return}
  if(type==="buy"){a.balance-=amount;i.cost+=amount;i.value+=amount;db.expenses.push({id:uid(),type:"expense",amount,currency:i.currency,category:"Yatırım · Alım",member:"",payment:a.name,date,merchant:i.name,note:$("investmentTransactionNote").value.trim(),investmentId:i.id})}
  if(type==="sell"){a.balance+=amount;i.value=Math.max(0,i.value-amount);i.qty=Math.max(0,i.qty-(i.qty*(amount/(i.value+amount))));db.income.push({id:uid(),type:"income",amount,currency:i.currency,source:"Yatırım · Satış",account:a.name,date,note:`${i.name}${$("investmentTransactionNote").value.trim()?" · "+$("investmentTransactionNote").value.trim():""}`,investmentId:i.id})}
  if(type==="update"){i.value=amount}
  i.status=i.value===0&&type==="sell"?"closed":"open";
  db.investmentTransactions.push({id:uid(),investmentId:i.id,type,amount,date,accountId,note:$("investmentTransactionNote").value.trim()});
  save();closeModal("investmentTransactionModal");toast("Yatırım işlemi kaydedildi")
}

async function previewInvestmentPrice(){
  if($("investmentAuto").value!=="auto"||!$("investmentSymbol").value){$("investmentLivePrice").textContent="-";return}
  if(!Object.keys(marketRates).length) await fetchMarketRates();
  const rate=findRate($("investmentSymbol").value);
  if(rate==null){$("investmentLivePrice").textContent="Desteklenmiyor";return}
  $("investmentLivePrice").textContent=Number(rate).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:4})+" "+$("investmentCurrency").value;
  $("investmentLiveUpdated").textContent="Canlı veri: "+new Date().toLocaleString("tr-TR");
}
$("investmentSymbol").oninput=previewInvestmentPrice;
$("investmentAuto").onchange=previewInvestmentPrice;
$("refreshInvestmentsBtn").onclick=refreshInvestments;
$("addInvestmentBtn").onclick=openInvestment;
$("investmentsModuleBtn").onclick=()=>document.getElementById("investmentsCard").scrollIntoView({behavior:"smooth"});
$("investmentForm").onsubmit=e=>{e.preventDefault();saveInvestment()};
$("investmentTransactionForm").onsubmit=e=>{e.preventDefault();saveInvestmentTx()};
document.querySelectorAll("[data-invest-filter]").forEach(b=>b.onclick=()=>{investmentFilter=b.dataset.investFilter;document.querySelectorAll("[data-invest-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
$("investmentList").addEventListener("click",e=>{
  const tx=e.target.closest("[data-invest-tx]"),ed=e.target.closest("[data-edit-invest]"),del=e.target.closest("[data-delete-invest]");
  if(tx)openInvestmentTx(tx.dataset.investTx);
  if(ed)editInvestment(ed.dataset.editInvest);
  if(del){const i=db.investments.find(x=>x.id===del.dataset.deleteInvest);if(i&&confirm(`${i.name} silinsin mi?`)){db.investments=db.investments.filter(x=>x.id!==i.id);db.investmentTransactions=db.investmentTransactions.filter(x=>x.investmentId!==i.id);save();toast("Yatırım silindi")}}
});

function openBill(){
  $("billForm").reset();$("billId").value="";$("billModalTitle").textContent="Fatura Ekle";openModal("billModal")
}
function saveBill(){
  const id=$("billId").value,data={type:$("billType").value,provider:$("billProvider").value.trim(),amount:Number($("billAmount").value),currency:$("billCurrency").value,dueDate:$("billDueDate").value,note:$("billNote").value.trim(),status:"unpaid"};
  if(!data.provider||!data.amount||!data.dueDate){toast("Sağlayıcı, tutar ve son ödeme tarihi gerekli");return}
  if(id){const b=db.bills.find(x=>x.id===id);Object.assign(b,data);toast("Fatura güncellendi")}
  else{data.id=uid();db.bills.push(data);toast("Fatura kaydedildi")}
  save();closeModal("billModal")
}
function editBill(id){
  const b=db.bills.find(x=>x.id===id);if(!b)return;
  $("billId").value=b.id;$("billType").value=b.type;$("billProvider").value=b.provider;$("billAmount").value=b.amount;$("billCurrency").value=b.currency;$("billDueDate").value=b.dueDate;$("billNote").value=b.note||"";$("billModalTitle").textContent="Fatura Düzenle";openModal("billModal")
}
function payBill(id){
  const b=db.bills.find(x=>x.id===id);if(!b)return;
  $("paymentBillId").value=id;$("billPaymentAmount").value=b.amount;$("billPaymentDate").value=today();
  $("billPaymentAccount").innerHTML=db.accounts.filter(a=>a.currency===b.currency).map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("")||`<option value="">${b.currency} hesap yok</option>`;
  openModal("billPaymentModal")
}
function saveBillPayment(){
  const id=$("paymentBillId").value,b=db.bills.find(x=>x.id===id),amount=Number($("billPaymentAmount").value),accountId=$("billPaymentAccount").value;
  if(!b||!amount||!accountId){toast("Tutar ve hesap gerekli");return}
  const a=db.accounts.find(x=>x.id===accountId);
  if(!a||a.currency!==b.currency||amount>b.amount){toast("Tutar veya hesap para birimini kontrol et");return}
  a.balance-=amount;
  db.expenses.push({id:uid(),type:"expense",amount,currency:b.currency,category:"Fatura · "+b.type,member:"",payment:a.name,date:$("billPaymentDate").value,merchant:b.provider,note:b.note||"",billId:b.id});
  if(amount===b.amount){b.status="paid";b.paidDate=$("billPaymentDate").value}else{b.status="unpaid";b.paid=amount}
  save();closeModal("billPaymentModal");toast("Fatura ödemesi kaydedildi")
}
$("addBillBtn").onclick=openBill;
$("billsModuleBtn").onclick=()=>document.getElementById("billsCard").scrollIntoView({behavior:"smooth"});
$("billForm").onsubmit=e=>{e.preventDefault();saveBill()};
$("billPaymentForm").onsubmit=e=>{e.preventDefault();saveBillPayment()};
document.querySelectorAll("[data-bill-filter]").forEach(b=>b.onclick=()=>{billFilter=b.dataset.billFilter;document.querySelectorAll("[data-bill-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
$("billList").addEventListener("click",e=>{
  const p=e.target.closest("[data-pay-bill]"),ed=e.target.closest("[data-edit-bill]"),del=e.target.closest("[data-delete-bill]");
  if(p)payBill(p.dataset.payBill);
  if(ed)editBill(ed.dataset.editBill);
  if(del){const b=db.bills.find(x=>x.id===del.dataset.deleteBill);if(b&&confirm(`${b.provider} faturası silinsin mi?`)){db.bills=db.bills.filter(x=>x.id!==b.id);save();toast("Fatura silindi")}}
});

function updateFuelPrice(){
  const liters=Number($("fuelLiters").value)||0,total=Number($("vehicleCost").value)||0;
  $("fuelPriceCalculated").textContent=(liters&&total?(total/liters).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}):"0,00")+" TL/L";
}
$("fuelLiters").oninput=updateFuelPrice;
$("vehicleCost").oninput=updateFuelPrice;

function openReminder(vehicleId){
  $("vehicleReminderForm").reset();
  $("reminderVehicleId").value=vehicleId;
  openModal("vehicleReminderModal");
}
$("vehicleList").addEventListener("click",e=>{
  const b=e.target.closest("[data-add-reminder]");
  if(b)openReminder(b.dataset.addReminder);
});
$("vehicleReminderForm").onsubmit=e=>{
  e.preventDefault();
  const vehicleId=$("reminderVehicleId").value,type=$("reminderType").value,dueDate=$("reminderDueDate").value;
  if(!vehicleId||!dueDate){toast("İşlem ve tarih gerekli");return}
  db.vehicleReminders.push({id:uid(),vehicleId,type,dueDate});
  save();closeModal("vehicleReminderModal");toast("Hatırlatma kaydedildi");
};
$("vehicleReminderList").addEventListener("click",e=>{
  const b=e.target.closest("[data-delete-reminder]");
  if(b){db.vehicleReminders=db.vehicleReminders.filter(x=>x.id!==b.dataset.deleteReminder);save();toast("Hatırlatma silindi")}
});

function openDebt(){
  $("debtForm").reset();$("debtId").value="";$("debtDate").value=today();$("debtModalTitle").textContent="Borç / Alacak Ekle";openModal("debtModal")
}
function saveDebt(){
  const id=$("debtId").value,type=$("debtType").value,person=$("debtPerson").value.trim(),amount=Number($("debtAmount").value),currency=$("debtCurrency").value;
  if(!person||!amount){toast("Kişi ve tutar gerekli");return}
  if(id){
    const d=db.debts.find(x=>x.id===id); if(!d)return;
    d.type=type;d.person=person;d.amount=amount;d.currency=currency;d.date=$("debtDate").value;d.dueDate=$("debtDueDate").value;d.note=$("debtNote").value.trim();
    save();closeModal("debtModal");toast("Kayıt güncellendi");
  }else{
    db.debts.push({id:uid(),type,person,amount,currency,date:$("debtDate").value,dueDate:$("debtDueDate").value,note:$("debtNote").value.trim(),paid:0,payments:[]});
    save();closeModal("debtModal");toast("Borç/alacak kaydedildi");
  }
}
function editDebt(id){
  const d=db.debts.find(x=>x.id===id);if(!d)return;
  $("debtId").value=d.id;$("debtType").value=d.type;$("debtPerson").value=d.person;$("debtAmount").value=d.amount;$("debtCurrency").value=d.currency;$("debtDate").value=d.date||today();$("debtDueDate").value=d.dueDate||"";$("debtNote").value=d.note||"";$("debtModalTitle").textContent="Borç / Alacak Düzenle";openModal("debtModal")
}
function payDebt(id){
  const d=db.debts.find(x=>x.id===id);if(!d)return;
  const remain=Math.max(0,d.amount-d.paid);$("paymentDebtId").value=id;$("debtPaymentAmount").value=remain;$("debtPaymentDate").value=today();$("debtPaymentTitle").textContent=d.type==="debt"?"Borç Öde":"Alacak Tahsil Et";
  const opts=db.accounts.filter(a=>a.currency===d.currency).map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  $("debtPaymentAccount").innerHTML=opts||`<option value="">${d.currency} hesap yok</option>`;
  openModal("debtPaymentModal")
}
function saveDebtPayment(){
  const id=$("paymentDebtId").value,d=db.debts.find(x=>x.id===id),amount=Number($("debtPaymentAmount").value),accountId=$("debtPaymentAccount").value;
  if(!d||!amount||!accountId){toast("Tutar ve hesap gerekli");return}
  const remain=d.amount-d.paid;if(amount>remain){toast("Kalan tutardan fazla ödeme yapılamaz");return}
  const a=db.accounts.find(x=>x.id===accountId);if(!a||a.currency!==d.currency){toast("Hesap para birimini kontrol et");return}
  const paymentId=uid();
  if(d.type==="debt"){
    a.balance-=amount;
    db.expenses.push({
      id:paymentId,type:"expense",amount,currency:d.currency,
      category:"Borç Ödemesi",member:"",payment:a.name,
      date:$("debtPaymentDate").value,
      merchant:d.person,note:$("debtPaymentNote").value.trim(),
      debtId:d.id,debtPaymentId:paymentId
    });
  }else{
    a.balance+=amount;
    db.income.push({
      id:paymentId,type:"income",amount,currency:d.currency,
      source:"Borç Tahsilatı",account:a.name,
      date:$("debtPaymentDate").value,
      note:`${d.person}${$("debtPaymentNote").value.trim()?" · "+$("debtPaymentNote").value.trim():""}`,
      debtId:d.id,debtPaymentId:paymentId
    });
  }
  d.paid+=amount;
  d.payments.push({id:paymentId,amount,date:$("debtPaymentDate").value,accountId,note:$("debtPaymentNote").value.trim()});
  save();closeModal("debtPaymentModal");toast(d.type==="debt"?"Borç ödemesi kaydedildi":"Alacak tahsilatı kaydedildi")
}
$("addDebtBtn").onclick=openDebt;
$("debtsModuleBtn").onclick=()=>document.getElementById("debtsCard").scrollIntoView({behavior:"smooth"});
$("debtForm").onsubmit=e=>{e.preventDefault();saveDebt()};
$("debtPaymentForm").onsubmit=e=>{e.preventDefault();saveDebtPayment()};
document.querySelectorAll("[data-debt-filter]").forEach(b=>b.onclick=()=>{debtFilter=b.dataset.debtFilter;document.querySelectorAll("[data-debt-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
$("debtList").addEventListener("click",e=>{
  const pay=e.target.closest("[data-pay-debt]"),ed=e.target.closest("[data-edit-debt]"),del=e.target.closest("[data-delete-debt]");
  if(pay)payDebt(pay.dataset.payDebt);
  if(ed)editDebt(ed.dataset.editDebt);
  if(del){const d=db.debts.find(x=>x.id===del.dataset.deleteDebt);if(d&&confirm(`"${d.person}" kaydı silinsin mi?`)){db.debts=db.debts.filter(x=>x.id!==d.id);save();toast("Kayıt silindi")}}
});

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".bottom-nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab-section").forEach(x=>x.classList.remove("active"));$(b.dataset.tab).classList.add("active")});

load();render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

setTimeout(()=>refreshInvestments(),800);
setInterval(()=>refreshInvestments(),15*60*1000);
