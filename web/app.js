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
  for(const k of ["members","accounts","expenses","investments","vehicles","bills"]){
    if(!Array.isArray(db[k]))db[k]=[];
  }
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

function render(){
  $("memberCount").textContent=db.members.length;
  $("totalBalance").textContent=money(db.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),"TRY");
  const ym=new Date().toISOString().slice(0,7);
  $("monthExpense").textContent=money(db.expenses.filter(x=>String(x.date||"").slice(0,7)===ym).reduce((s,x)=>s+(Number(x.amount)||0),0),"TRY");

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
    ? db.investments.slice().reverse().map(x=>`<div class="item"><span>${escapeHtml(x.name)}</span><b>${money(x.amount,x.currency||"TRY")}</b></div>`).join("")
    : `<div class="empty">Henüz yatırım yok.</div>`;

  $("reportText").innerHTML=`<b>${db.members.length}</b> üye, <b>${db.accounts.length}</b> hesap/kart, <b>${db.expenses.length}</b> harcama, <b>${db.investments.length}</b> yatırım ve <b>${db.vehicles.length}</b> araç kaydı var.`;
}

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
  document.querySelectorAll("#bottomNav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  window.scrollTo(0,0);
}

/* ONE and only one navigation listener. */
$("bottomNav").addEventListener("click",e=>{
  const b=e.target.closest("button[data-page]");
  if(!b)return;
  e.preventDefault();
  page(b.dataset.page);
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

$("addInvestment").onclick=()=>alert("Yatırım modülü bir sonraki aşamada bağlanacak.");

load();
render();
})();