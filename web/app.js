const KEY='ailefinans_v2';
const defaults={members:['Sebahattin','Eşim'],accounts:['Nakit','Banka Kartı','Kredi Kartı'],expenses:[],income:[]};
let db=JSON.parse(localStorage.getItem(KEY)||'null')||defaults;
const categories=['Market','Giyim','Elektronik','Ev','Restoran','Kişisel Bakım','Ulaşım','Sağlık','Fatura','Diğer'];
const icons={Market:'🛒',Giyim:'👕',Elektronik:'💻',Ev:'🏠',Restoran:'🍽️','Kişisel Bakım':'🧴',Ulaşım:'🚕',Sağlık:'🏥',Fatura:'💡',Diğer:'💸'};
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function money(n,c='TRY ₺'){const code=c.slice(0,3);const cur=code==='TRY'?'TRY':code;return new Intl.NumberFormat('tr-TR',{style:'currency',currency:cur}).format(Number(n)||0)}
function el(id){return document.getElementById(id)}
function show(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));el(id).classList.add('active');el('pageTitle').textContent=({home:'Ana Sayfa',expenses:'Harcamalar',investments:'Yatırımlar',reports:'Raporlar',more:'Daha Fazla',members:'Üyeler',accounts:'Hesaplar & Kartlar',vehicles:'Araçlar',bills:'Faturalar',debts:'Borçlar',health:'Sağlık'})[id]||'AileFinans'}
function openModal(id){el(id).classList.add('show')}
function closeModal(id){el(id).classList.remove('show')}
function populate(){
 el('category').innerHTML=categories.map(x=>`<option>${x}</option>`).join('');
 el('filterCategory').innerHTML='<option value="">Tüm kategoriler</option>'+categories.map(x=>`<option>${x}</option>`).join('');
 el('member').innerHTML=db.members.map(x=>`<option>${x}</option>`).join('');
 el('filterMember').innerHTML='<option value="">Tüm üyeler</option>'+db.members.map(x=>`<option>${x}</option>`).join('');
 el('payment').innerHTML=db.accounts.map(x=>`<option>${x}</option>`).join('');
}
function render(){
 populate();
 const total=db.expenses.reduce((s,x)=>s+Number(x.amount||0),0);
 el('totalExpense').textContent=money(total);
 el('expenseCount').textContent=`${db.expenses.length} işlem`;
 const inc=db.income.reduce((s,x)=>s+Number(x.amount||0),0); el('totalIncome').textContent=money(inc);
 const list=[...db.expenses].reverse();
 el('recent').innerHTML=list.length?list.slice(0,8).map(itemHTML).join(''):'<div class="empty">Henüz harcama yok.<br>İlk kaydı ekleyelim.</div>';
 renderExpenses(); renderMembers(); renderAccounts();
}
function itemHTML(x){return `<article class="item"><div class="item-icon">${icons[x.category]||'💸'}</div><div class="item-main"><b>${esc(x.category)}${x.merchant?' · '+esc(x.merchant):''}</b><small>${esc(x.member||'')} · ${esc(x.payment||'')} · ${new Date(x.date).toLocaleDateString('tr-TR')}</small></div><div class="item-amount">-${money(x.amount,x.currency)}</div></article>`}
function renderExpenses(){
 const cat=el('filterCategory').value||'', mem=el('filterMember').value||'';
 const arr=[...db.expenses].reverse().filter(x=>(!cat||x.category===cat)&&(!mem||x.member===mem));
 el('expenseList').innerHTML=arr.length?arr.map(itemHTML).join(''):'<div class="empty">Filtreye uyan harcama yok.</div>';
}
function renderMembers(){el('memberList').innerHTML=db.members.map(x=>`<div class="item"><div class="item-icon">👤</div><div class="item-main"><b>${esc(x)}</b><small>Aile üyesi</small></div></div>`).join('')}
function renderAccounts(){el('accountList').innerHTML=db.accounts.map(x=>`<div class="item"><div class="item-icon">💳</div><div class="item-main"><b>${esc(x)}</b><small>Ödeme yöntemi</small></div></div>`).join('')}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function openExpense(){el('expenseForm').reset();el('date').value=new Date().toISOString().slice(0,10);el('preview').classList.add('hidden');populate();openModal('expenseModal')}
el('quickAdd').onclick=openExpense;el('addExpense2').onclick=openExpense;
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>show(b.dataset.nav));
document.querySelectorAll('.menu-grid button').forEach(b=>b.onclick=()=>show(b.dataset.section));
el('filterCategory').onchange=renderExpenses;el('filterMember').onchange=renderExpenses;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
el('expenseForm').onsubmit=e=>{e.preventDefault();const file=el('photo').files[0];const add=x=>{db.expenses.push(x);save();closeModal('expenseModal');show('expenses')};const base={amount:Number(el('amount').value),currency:el('currency').value,category:el('category').value,subcategory:el('subcategory').value,member:el('member').value,payment:el('payment').value,date:el('date').value,merchant:el('merchant').value,note:el('note').value};if(file){const r=new FileReader();r.onload=()=>add({...base,photo:r.result});r.readAsDataURL(file)}else add(base)};
el('photo').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{el('preview').src=r.result;el('preview').classList.remove('hidden')};r.readAsDataURL(f)};
el('clearAll').onclick=()=>{if(confirm('Tüm harcama kayıtları silinsin mi?')){db.expenses=[];save()}};
el('addMember').onclick=()=>simpleAdd('Yeni Üye','Üye adı',x=>{if(x){db.members.push(x);save()}});
el('addAccount').onclick=()=>simpleAdd('Yeni Ödeme Yöntemi','Banka / Kart / Nakit adı',x=>{if(x){db.accounts.push(x);save()}});
function simpleAdd(title,placeholder,done){el('simpleTitle').textContent=title;el('simpleForm').innerHTML=`<input id="simpleInput" placeholder="${placeholder}" required><button class="primary" style="margin-top:12px">Kaydet</button>`;el('simpleForm').onsubmit=e=>{e.preventDefault();done(el('simpleInput').value.trim());closeModal('simpleModal')};openModal('simpleModal')}
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
