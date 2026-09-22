const KEY="ailefinans_v4";
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
    for(const k of OLD_KEYS){const x=localStorage.getItem(k);if(x){raw=x;break}}
  }
  let x={};
  try{x=raw?JSON.parse(raw):{}}catch(e){}
  db={
    members:Array.isArray(x.members)&&x.members.length?x.members:["Sebahattin","Eşim"],
    accounts:Array.isArray(x.accounts)?x.accounts.map(normalizeAccount):[],
    expenses:Array.isArray(x.expenses)?x.expenses:[],
    income:Array.isArray(x.income)?x.income:[]
  };
  if(!db.accounts.length){
    db.accounts=[
      {id:uid(),name:"Nakit",type:"Nakit",balance:0,currency:"TRY"},
      {id:uid(),name:"Banka Kartı",type:"Banka",balance:0,currency:"TRY"},
      {id:uid(),name:"Kredi Kartı",type:"Kredi Kartı",balance:0,currency:"TRY"}
    ];
  }
  localStorage.setItem(KEY,JSON.stringify(db));
}
let db={members:[],accounts:[],expenses:[],income:[]};

function render(){
  $("accountCount").textContent=db.accounts.length;
  const inc=db.income.reduce((s,x)=>s+Number(x.amount||0),0);
  const exp=db.expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  $("incomeTotal").textContent=money(inc);
  $("expenseTotal").textContent=money(exp);

  $("accountList").innerHTML=db.accounts.length?db.accounts.map(a=>`
    <div class="item">
      <div class="item-main"><div class="item-title">${esc(a.name)}</div><div class="item-sub">${esc(a.type)} · ${a.currency}</div></div>
      <div class="item-right"><div class="amount">${money(a.balance,a.currency)}</div>
        <div class="actions"><button class="icon-btn" data-edit="${a.id}">Düzenle</button><button class="icon-btn danger" data-delete="${a.id}">Sil</button></div>
      </div>
    </div>`).join(""):`<div class="empty">Henüz hesap veya kart yok.</div>`;

  $("memberList").innerHTML=db.members.map((m,i)=>`<div class="item"><div>${esc(m)}</div>${i>1?`<button class="icon-btn danger" data-member-delete="${i}">Sil</button>`:""}</div>`).join("");

  const opts=db.accounts.map(a=>`<option value="${escAttr(a.name)}">${esc(a.name)} · ${a.currency}</option>`).join("");
  $("incomeAccount").innerHTML=opts||`<option value="">Önce hesap ekle</option>`;
  $("expensePayment").innerHTML=opts||`<option value="">Önce hesap ekle</option>`;
  $("expenseMember").innerHTML=db.members.map(m=>`<option>${esc(m)}</option>`).join("");

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

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".bottom-nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab-section").forEach(x=>x.classList.remove("active"));$(b.dataset.tab).classList.add("active")});

load();render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
