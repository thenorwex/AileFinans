const KEY='ailefinans_expenses_v1';
const $=id=>document.getElementById(id);
let expenses=JSON.parse(localStorage.getItem(KEY)||'[]');
const icons={Market:'🛒',Giyim:'👕',Elektronik:'💻',Ev:'🏠',Restoran:'🍽️','Kişisel bakım':'🧴',Araç:'🚗',Fatura:'💡',Sağlık:'🏥',Diğer:'💸'};
function money(n,c='TRY'){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:c}).format(n)}catch{return `${n} ${c}`}}
function render(){
  const list=$('list'); $('count').textContent=expenses.length;
  const total=expenses.filter(x=>x.currency==='TRY').reduce((s,x)=>s+x.amount,0); $('total').textContent=money(total,'TRY');
  if(!expenses.length){list.innerHTML='<div class="empty">Henüz harcama yok.<br>İlk kaydı ekleyelim.</div>';return}
  list.innerHTML=expenses.slice().reverse().map((x,i)=>`<article class="item"><div class="icon">${icons[x.category]||'💸'}</div><div class="item-main"><b>${escapeHtml(x.merchant||x.category)}</b><small>${escapeHtml(x.member)} · ${escapeHtml(x.payment)} · ${new Date(x.date).toLocaleDateString('tr-TR')}</small></div><div class="item-amount">-${money(x.amount,x.currency)}</div></article>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function openDialog(){$('expenseDialog').showModal()}
$('addTop').onclick=openDialog;
$('close').onclick=()=>$('expenseDialog').close();
$('clear').onclick=()=>{if(confirm('Tüm yerel harcama kayıtları silinsin mi?')){expenses=[];localStorage.removeItem(KEY);render()}};
$('expenseForm').addEventListener('submit',e=>{e.preventDefault();const amount=parseFloat($('amount').value.replace(',','.'));if(!amount||amount<0)return alert('Geçerli bir tutar gir.');expenses.push({amount,currency:$('currency').value,category:$('category').value,member:$('member').value||'Belirtilmedi',payment:$('payment').value,merchant:$('merchant').value,note:$('note').value,date:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify(expenses));e.target.reset();$('expenseDialog').close();render()});
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});render();
