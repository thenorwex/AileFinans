(() => {
'use strict';
const KEY='ailefinans_v44';
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=(n,c='TRY')=>{try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:c}).format(Number(n)||0)}catch{return `${(Number(n)||0).toFixed(2)} ${c}`}};
const base={members:[],accounts:[],incomes:[],expenses:[],investments:[],vehicles:[],bills:[],vehicleLogs:[],fuelLogs:[],serviceLogs:[],documentLogs:[],expenseCategories:['Market','Yakıt','Fatura','Sağlık','Kira','Alışveriş','Restoran','Eğitim','Araç','Diğer'],settings:{appName:'Aile Finans',currency:'TRY',theme:'system',city:'Antalya'}};
let db=structuredClone(base);
let currentPage='home', activeVehicleId=null, editingExpenseId=null;

function normalize(){
  for(const k of Object.keys(base)) if(Array.isArray(base[k])&&!Array.isArray(db[k])) db[k]=[];
  for(const k of ['members','accounts','incomes','expenses','investments','vehicles','bills','vehicleLogs','fuelLogs','serviceLogs','documentLogs']) if(!Array.isArray(db[k])) db[k]=[];
  db.expenseCategories=Array.isArray(db.expenseCategories)&&db.expenseCategories.length?db.expenseCategories:base.expenseCategories.slice();
  db.settings={...base.settings,...(db.settings||{})};
  db.members=db.members.map(m=>typeof m==='string'?m:(m?.name||m?.fullName||'')).filter(Boolean);
  db.accounts=db.accounts.map(a=>({id:a.id||uid(),name:a.name||'Hesap',type:a.type==='cash'||a.type==='Nakit'?'cash':a.type==='bank'||a.type==='Banka'?'bank':a.type==='card'||a.type==='Kredi Kartı'?'card':'bank',balance:Number(a.balance)||0,currency:a.currency==='cash'||a.currency==='bank'?'TRY':(a.currency||'TRY'),initialBalance:Number(a.initialBalance??a.balance)||0}));
  db.vehicles=db.vehicles.map(v=>({id:v.id||uid(),name:v.name||'Araç',plate:v.plate||'',fuel:v.fuel||'',km:Number(v.km)||0,purchasePrice:Number(v.purchasePrice)||0,purchaseDate:v.purchaseDate||''}));
  db.investments=db.investments.map(x=>({...x,id:x.id||uid(),quantity:Number(x.quantity)||0,buyPrice:Number(x.buyPrice)||0,livePrice:Number(x.livePrice)||0,priceHistory:Array.isArray(x.priceHistory)?x.priceHistory:[]}));
}
function migrate(){
  let raw=null; for(const k of [KEY,'ailefinans_v41','ailefinans_v40','ailefinans_v39','ailefinans_v38','ailefinans_v37','ailefinans_v36']){try{raw=localStorage.getItem(k);if(raw)break}catch{}}
  if(!raw){normalize();return}
  try{db={...structuredClone(base),...JSON.parse(raw)};normalize();
    // Old vehicle arrays used different names.
    if(!db.fuelLogs.length && Array.isArray(db.vehicleFuelLogs)) db.fuelLogs=db.vehicleFuelLogs.map(x=>({...x,id:x.id||uid(),vehicleId:x.vehicleId,liters:Number(x.liters)||0,total:Number(x.total||x.amount)||0,km:Number(x.km)||0,date:x.date||today(),accountId:x.accountId||''}));
    if(!db.serviceLogs.length && Array.isArray(db.vehicleServices)) db.serviceLogs=db.vehicleServices.map(x=>({...x,id:x.id||uid(),vehicleId:x.vehicleId,title:x.title||'Bakım',cost:Number(x.cost)||0,km:Number(x.km)||0,nextKm:Number(x.nextKm)||0,date:x.date||today(),accountId:x.accountId||''}));
    if(!db.documentLogs.length && Array.isArray(db.vehicleDocuments)) db.documentLogs=db.vehicleDocuments.map(x=>({...x,id:x.id||uid(),vehicleId:x.vehicleId,type:x.type||'Belge',cost:Number(x.cost)||0,date:x.date||today(),expiry:x.expiry||'',accountId:x.accountId||''}));
  }catch{db=structuredClone(base)} normalize();
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));$('status').textContent='Kaydedildi';return true}catch(e){console.error(e);$('status').textContent='Kayıt hatası';return false}}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
function openModal(id){const m=$(id);if(m){m.hidden=false}}
function closeModal(id){const m=$(id);if(m)m.hidden=true}
function closeAllModals(){document.querySelectorAll('.modal').forEach(m=>m.hidden=true)}
function applyTheme(){const t=db.settings.theme||'system';document.documentElement.dataset.theme=t}
function fillAccounts(id,placeholder='Hesap seç'){const el=$(id);if(!el)return;el.innerHTML='<option value="">'+placeholder+'</option>'+db.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${money(a.balance,a.currency)}</option>`).join('')}
function fillMembers(id){const el=$(id);if(!el)return;el.innerHTML='<option value="">Genel / Üye yok</option>'+db.members.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}
function monthKey(date){return String(date||'').slice(0,7)}
function currentMonth(){return today().slice(0,7)}
function sum(arr,key='amount'){return arr.reduce((s,x)=>s+(Number(x[key])||0),0)}
function accountById(id){return db.accounts.find(a=>String(a.id)===String(id))}
function changeAccount(id,delta,currency='TRY'){const a=accountById(id);if(!a||a.currency!==currency)return false;a.balance=(Number(a.balance)||0)+Number(delta||0);return true}
function totalBalance(){return db.accounts.filter(a=>a.currency===db.settings.currency).reduce((s,a)=>s+(Number(a.balance)||0),0)}
function addExpenseRecord({title,amount,currency='TRY',member='',category='Diğer',accountId='',date=today(),note='',sourceType='',sourceId=''}){
  const n=Number(amount)||0;if(n<=0)return null;const a=accountById(accountId);if(a&&a.currency===currency)a.balance-=n;
  const x={id:uid(),title,amount:n,currency,member,category,accountId,payment:a?.name||'',date,note,sourceType,sourceId};db.expenses.push(x);return x;
}
function removeExpenseRecord(id,restore=true){const x=db.expenses.find(e=>e.id===id);if(!x)return; if(restore&&x.accountId)changeAccount(x.accountId,Number(x.amount)||0,x.currency);db.expenses=db.expenses.filter(e=>e.id!==id)}
function editExpenseBalance(oldX,newX){if(oldX.accountId)changeAccount(oldX.accountId,Number(oldX.amount)||0,oldX.currency);const a=accountById(newX.accountId);if(a&&a.currency===newX.currency)a.balance-=Number(newX.amount)||0}

function render(){
  normalize();applyTheme();
  $('appName').textContent=db.settings.appName||'Aile Finans';
  $('appSubtitle').textContent='Aile bütçesi';
  renderHome();renderExpenses();renderInvestments();renderVehicles();renderBills();renderReports();renderSettings();
}
function navigate(page){currentPage=page;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));closeMenu();window.scrollTo({top:0,behavior:'smooth'});if(page==='home')refreshWeather()}
function openMenu(){$('sideNav').classList.add('open');$('menuOverlay').classList.add('show');$('sideNav').setAttribute('aria-hidden','false')}
function closeMenu(){$('sideNav').classList.remove('open');$('menuOverlay').classList.remove('show');$('sideNav').setAttribute('aria-hidden','true')}
function renderHome(){
  const ym=currentMonth(), incomes=db.incomes.filter(x=>monthKey(x.date)===ym), expenses=db.expenses.filter(x=>monthKey(x.date)===ym);
  const inc=sum(incomes), exp=sum(expenses), inv=db.investments.reduce((s,x)=>s+(x.livePrice>0?x.livePrice*x.quantity:0),0);
  $('todayDateLabel').textContent=new Intl.DateTimeFormat('tr-TR',{dateStyle:'full'}).format(new Date());$('dailyDate').textContent=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long'}).format(new Date());
  $('homeNet').textContent=money(inc-exp);$('homeMonthLabel').textContent=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date());$('totalBalance').textContent=money(totalBalance());$('monthIncome').textContent=money(inc);$('monthExpense').textContent=money(exp);$('memberCount').textContent=db.members.length;$('investmentTotal').textContent=money(inv);
  const pending=db.bills.filter(b=>!b.paid);$('homeBillTotal').textContent=money(sum(pending));
  const vehicleMonth=db.expenses.filter(x=>x.sourceType==='vehicle'&&monthKey(x.date)===ym);$('homeVehicleTotal').textContent=money(sum(vehicleMonth));
  $('sideTotal').textContent=money(totalBalance());
  $('homeAccounts').innerHTML=db.accounts.length?db.accounts.map(a=>`<div class="item"><span><b>${esc(a.name)}</b><small>${a.type==='cash'?'Nakit':a.type==='bank'?'Banka':'Kredi Kartı'} · ${esc(a.currency)}</small></span><b>${money(a.balance,a.currency)}</b></div>`).join(''):'<div class="empty">Henüz hesap eklenmedi.</div>';
  $('homeMembers').innerHTML=db.members.length?db.members.map(m=>`<div class="item"><span>${esc(m)}</span><button data-remove-member="${esc(m)}">Sil</button></div>`).join(''):'<div class="empty">Henüz üye yok.</div>';
  renderDailyHistory();
}
function renderDailyHistory(){
  const d=new Date(),md=`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const events={
    '01-01':['Yeni yılın ilk günü.','Birçok ülkede yeni takvim yılının başlangıcı olarak kutlanır.'],
    '02-14':['Sevgililer Günü.','Dünyanın birçok yerinde sevgi ve yakın ilişkiler temasıyla anılır.'],
    '03-08':['Dünya Kadınlar Günü.','Kadınların toplumsal, ekonomik ve kültürel katkılarına dikkat çekilen uluslararası gün.'],
    '04-23':['23 Nisan.','Türkiye’de Ulusal Egemenlik ve Çocuk Bayramı olarak kutlanır.'],
    '05-01':['1 Mayıs.','Emek ve Dayanışma Günü olarak anılır.'],
    '05-19':['19 Mayıs.','Atatürk’ü Anma, Gençlik ve Spor Bayramı.'],
    '06-05':['Dünya Çevre Günü.','Çevre sorunlarına yönelik farkındalığı artırmayı amaçlayan uluslararası gün.'],
    '07-15':['15 Temmuz.','Türkiye’de Demokrasi ve Millî Birlik Günü olarak anılır.'],
    '08-30':['30 Ağustos.','Zafer Bayramı olarak kutlanır.'],
    '10-29':['29 Ekim.','Türkiye Cumhuriyeti’nin kuruluşunun yıl dönümüdür.'],
    '11-10':['10 Kasım.','Mustafa Kemal Atatürk’ün vefatının yıl dönümünde anma törenleri yapılır.'],
    '12-10':['İnsan Hakları Günü.','İnsan Hakları Evrensel Beyannamesi’nin kabul edildiği günün yıldönümüdür.']
  };
  const list=events[md]||['Bugünün notu','Bugün için tanımlanmış özel bir ulusal gün bulunmuyor. Tarih boyunca farklı olaylar bu güne denk gelmiştir.'];
  $('dailyHistory').innerHTML=`<div class="history-event"><b>${esc(list[0])}</b><span class="muted">${esc(list[1])}</span></div><div class="history-event"><b>Günün önerisi</b><span class="muted">Bugünkü gelir ve giderlerini kaydet, ay sonu raporunda karşılaştır.</span></div>`;
}
async function refreshWeather(){
  const city=(db.settings.city||'Antalya').trim()||'Antalya';$('weatherLocation').textContent=city;$('weatherBox').innerHTML='<span class="muted">Hava durumu alınıyor...</span>';
  try{const g=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`).then(r=>{if(!r.ok)throw Error();return r.json()});const p=g.results?.[0];if(!p)throw Error();const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`).then(r=>{if(!r.ok)throw Error();return r.json()});const c=w.current;const map={0:['☀️','Açık'],1:['🌤️','Çoğunlukla açık'],2:['⛅','Parçalı bulutlu'],3:['☁️','Kapalı'],45:['🌫️','Sis'],48:['🌫️','Kırağılı sis'],51:['🌦️','Hafif çiseleme'],61:['🌧️','Yağmurlu'],63:['🌧️','Yağmurlu'],65:['🌧️','Kuvvetli yağmur'],71:['🌨️','Kar'],80:['🌦️','Sağanak'],81:['🌦️','Sağanak'],82:['⛈️','Kuvvetli sağanak'],95:['⛈️','Gök gürültülü']};const info=map[c.weather_code]||['🌡️','Değişken'];$('weatherBox').innerHTML=`<div class="weather-main"><div class="weather-icon">${info[0]}</div><div><div class="weather-temp">${Math.round(c.temperature_2m)}°C</div><b>${info[1]}</b><small class="muted">Hissedilen ${Math.round(c.apparent_temperature)}°C · Rüzgar ${Math.round(c.wind_speed_10m)} km/sa</small></div></div>`;}
  catch{$('weatherBox').innerHTML='<span class="muted">Hava durumu verisi alınamadı. Ayarlardan şehri kontrol et.</span>'}
}
function renderExpenses(){
  const arr=[...db.expenses].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('expenseList').innerHTML=arr.length?arr.map(x=>`<div class="item"><span><b>${esc(x.title)}</b><small>${esc(x.category)} · ${esc(x.member||'Genel')} · ${esc(x.date)}${x.payment?' · '+esc(x.payment):''}</small></span><span><b>${money(x.amount,x.currency)}</b><br><button data-edit-expense="${x.id}">Düzenle</button> <button data-delete-expense="${x.id}">Sil</button></span></div>`).join(''):'<div class="empty">Henüz harcama yok.</div>';
}
function investmentValue(x){return x.livePrice>0?x.livePrice*x.quantity:0}
function renderInvestments(){
  const total=db.investments.reduce((s,x)=>s+investmentValue(x),0), cost=db.investments.reduce((s,x)=>s+x.buyPrice*x.quantity,0), pnl=total-cost;
  $('investmentSummary').innerHTML=`<div class="card"><small>Güncel Değer</small><b>${money(total)}</b></div><div class="card"><small>Maliyet</small><b>${money(cost)}</b></div><div class="card"><small>Kâr / Zarar</small><b class="${pnl>=0?'gain':'loss'}">${pnl>=0?'+':''}${money(pnl)}</b></div>`;
  $('investmentList').innerHTML=db.investments.length?db.investments.map(x=>{const v=investmentValue(x),pnl=v-x.buyPrice*x.quantity;const last=x.priceHistory?.at(-1);return `<div class="item"><span><b>${esc(x.name)}</b><small>${esc(x.symbol||'Kod yok')} · ${esc(x.quantity)} · alış ${money(x.buyPrice,x.currency)}</small><small>Güncel: ${x.livePrice>0?money(x.livePrice,x.currency):'Fiyat girilmedi'}${last?' · '+esc(last.date):''}</small></span><span><b class="${pnl>=0?'gain':'loss'}">${pnl>=0?'+':''}${money(pnl,x.currency)}</b><br><button data-price="${x.id}">Fiyat Güncelle</button> <button data-delete-investment="${x.id}">Sil</button></span></div>`}).join(''):'<div class="empty">Henüz yatırım eklenmedi.</div>';
}
function vehicleKm(v){const logs=db.vehicleLogs.filter(x=>x.vehicleId===v.id).map(x=>Number(x.km)||0);const fuels=db.fuelLogs.filter(x=>x.vehicleId===v.id).map(x=>Number(x.km)||0);return Math.max(Number(v.km)||0,...logs,...fuels,0)}
function fuelStats(vehicleId,ym=''){let logs=db.fuelLogs.filter(x=>x.vehicleId===vehicleId);if(ym)logs=logs.filter(x=>monthKey(x.date)===ym);const liters=sum(logs,'liters'),cost=sum(logs,'total');const kms=[...logs].filter(x=>Number.isFinite(Number(x.km))).sort((a,b)=>Number(a.km)-Number(b.km));const distance=kms.length>1?Math.max(0,Number(kms.at(-1).km)-Number(kms[0].km)):0;return{liters,cost,distance,l100:distance?liters/distance*100:0,tlkm:distance?cost/distance:0,price:liters?cost/liters:0}}
function renderVehicles(){
  $('vehicleList').innerHTML=db.vehicles.length?db.vehicles.map(v=>{const fs=fuelStats(v.id),month=fuelStats(v.id,currentMonth());return `<div class="item"><span><b>${esc(v.name)}</b><small>${esc(v.plate||'Plaka yok')} · ${vehicleKm(v).toLocaleString('tr-TR')} km · ${esc(v.fuel||'')}</small><small>Aylık yakıt: ${month.liters.toFixed(1)} L · ${money(month.cost)} · ${month.l100?month.l100.toFixed(1)+' L/100 km':'km verisi bekleniyor'}</small></span><span><button data-open-vehicle="${v.id}">Aç</button> <button data-delete-vehicle="${v.id}">Sil</button></span></div>`}).join(''):'<div class="empty">Henüz araç eklenmedi.</div>';
}
function openVehicle(v){
  activeVehicleId=v.id;const fs=fuelStats(v.id),m=fuelStats(v.id,currentMonth());const services=db.serviceLogs.filter(x=>x.vehicleId===v.id);const docs=db.documentLogs.filter(x=>x.vehicleId===v.id);const totalVehicle=db.expenses.filter(x=>x.sourceType==='vehicle'&&x.sourceId===v.id).reduce((s,x)=>s+x.amount,0);
  $('vehicleDetailTitle').textContent=v.name;$('vehicleDetailSummary').innerHTML=`<div class="vehicle-summary"><div class="summary-cell"><small>Kilometre</small><b>${vehicleKm(v).toLocaleString('tr-TR')} km</b><span>${esc(v.plate||'Plaka yok')}</span></div><div class="summary-cell"><small>Bu ay yakıt</small><b>${money(m.cost)}</b><span>${m.liters.toFixed(1)} L · ${m.l100?m.l100.toFixed(1)+' L/100 km':'-'}</span></div><div class="summary-cell"><small>Toplam yakıt</small><b>${money(fs.cost)}</b><span>${fs.liters.toFixed(1)} L · ${fs.price?money(fs.price)+'/L':'-'}</span></div><div class="summary-cell"><small>Toplam araç gideri</small><b>${money(totalVehicle)}</b><span>${services.length} bakım · ${docs.length} belge</span></div></div>`;
  const fuelRows=db.fuelLogs.filter(x=>x.vehicleId===v.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>`<div class="item"><span>⛽ ${x.date} · ${x.liters} L · ${Number(x.km).toLocaleString('tr-TR')} km</span><b>${money(x.total)}</b></div>`).join('');
  const serviceRows=services.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>`<div class="item"><span>🔧 ${esc(x.title)} · ${x.date} · ${Number(x.km||0).toLocaleString('tr-TR')} km</span><b>${money(x.cost)}</b></div>`).join('');
  const docRows=docs.sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry))).map(x=>`<div class="item"><span>📄 ${esc(x.type)} · ${x.date} → ${x.expiry}</span><b>${money(x.cost)}</b></div>`).join('');
  $('vehicleHistory').innerHTML=(fuelRows+serviceRows+docRows)||'<div class="empty">Henüz kayıt yok.</div>';openModal('vehicleDetailModal');
}
function renderBills(){
  const pending=db.bills.filter(b=>!b.paid), overdue=pending.filter(b=>b.dueDate&&b.dueDate<today());$('billSummary').innerHTML=`<div class="card"><small>Bekleyen</small><b>${money(sum(pending))}</b></div><div class="card"><small>Geciken</small><b class="${overdue.length?'loss':''}">${money(sum(overdue))}</b></div><div class="card"><small>Toplam fatura</small><b>${db.bills.length}</b></div>`;
  $('billsList').innerHTML=db.bills.length?db.bills.sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(b=>`<div class="item"><span><b>${esc(b.name)}</b><small>${esc(b.category)} · son ödeme ${esc(b.dueDate||'-')}${b.recurring?' · düzenli':''}</small></span><span><b>${money(b.amount)}</b><br>${b.paid?'<span class="gain">Ödendi</span>':`<button data-pay-bill="${b.id}">Ödendi</button>`} <button data-delete-bill="${b.id}">Sil</button></span></div>`).join(''):'<div class="empty">Henüz fatura yok.</div>';
}
function reportMonths(){const s=new Set([currentMonth()]);[...db.incomes,...db.expenses,...db.bills].forEach(x=>{if(/^\d{4}-\d{2}/.test(x.date||x.dueDate||''))s.add(monthKey(x.date||x.dueDate))});return [...s].sort().reverse()}
function renderReports(){
  const oldMember=$('reportMember').value,oldMonth=$('reportMonth').value;const months=reportMonths();$('reportMember').innerHTML='<option value="">Genel</option>'+db.members.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');$('reportMember').value=db.members.includes(oldMember)?oldMember:'';$('reportMonth').innerHTML=months.map(m=>`<option value="${m}">${esc(new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date(m+'-01')))}</option>`).join('');$('reportMonth').value=months.includes(oldMonth)?oldMonth:months[0];
  const member=$('reportMember').value,ym=$('reportMonth').value,filter=x=>!member||x.member===member;const inc=db.incomes.filter(x=>monthKey(x.date)===ym&&filter(x)),exp=db.expenses.filter(x=>monthKey(x.date)===ym&&filter(x));const income=sum(inc),expense=sum(exp),net=income-exp;const cats={};exp.forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount));const rows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')||'<div class="empty">Gider yok.</div>';const archive=months.map(m=>{const i=sum(db.incomes.filter(x=>monthKey(x.date)===m&&filter(x)));const e=sum(db.expenses.filter(x=>monthKey(x.date)===m&&filter(x)));return `<button class="month-card" data-report-month="${m}"><b>${esc(new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date(m+'-01')))}</b><small>Gelir ${money(i)} · Gider ${money(e)}</small><strong>${money(i-e)}</strong></button>`}).join('');
  $('reportText').innerHTML=`<div class="report-hero"><small>${member?esc(member):'Aile geneli'}</small><h2>${net>=0?'+':''}${money(net)}</h2><span>${esc(new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date(ym+'-01')))}</span></div><div class="report-grid"><div class="report-card"><small>Gelir</small><b>${money(income)}</b><span>${inc.length} işlem</span></div><div class="report-card"><small>Gider</small><b>${money(expense)}</b><span>${exp.length} işlem</span></div><div class="report-card"><small>Bakiye</small><b>${money(totalBalance())}</b><span>Nakit + banka</span></div><div class="report-card"><small>Yatırım</small><b>${money(db.investments.reduce((s,x)=>s+investmentValue(x),0))}</b><span>${db.investments.length} kayıt</span></div></div><div class="report-columns"><div class="panel"><h3>Harcama Dağılımı</h3>${rows}</div><div class="panel"><h3>Özet</h3><div class="report-row"><span>Üyeler</span><b>${member?esc(member):db.members.length+' kişi'}</b></div><div class="report-row"><span>Araçlar</span><b>${db.vehicles.length}</b></div><div class="report-row"><span>Faturalar</span><b>${db.bills.length}</b></div></div></div><div class="panel" style="margin-top:14px"><h3>Aylık Arşiv</h3><div class="month-grid">${archive}</div></div>`;
}
function renderSettings(){const s=db.settings;$('settingAppName').value=s.appName||'Aile Finans';$('settingCurrency').value=s.currency||'TRY';$('settingTheme').value=s.theme||'system';$('settingCity').value=s.city||'Antalya';$('settingCategories').value=db.expenseCategories.join(', ')}

// Menu / navigation
$('menuToggle').onclick=openMenu;$('menuClose').onclick=closeMenu;$('menuOverlay').onclick=closeMenu;$('sideNav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeAllModals()}});
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');if(close){closeModal(close.dataset.close);return}
  const rm=e.target.closest('[data-remove-member]');if(rm){const name=rm.dataset.removeMember;if(confirm(`${name} silinsin mi?`)){db.members=db.members.filter(m=>m!==name);save();render()};return}
  const edit=e.target.closest('[data-edit-expense]');if(edit){openExpenseEdit(edit.dataset.editExpense);return}
  const del=e.target.closest('[data-delete-expense]');if(del){const x=db.expenses.find(q=>q.id===del.dataset.deleteExpense);if(x&&confirm(`${x.title} silinsin mi?`)){removeExpenseRecord(x.id,true);save();render();toast('Harcama silindi')};return}
  const price=e.target.closest('[data-price]');if(price){const x=db.investments.find(q=>q.id===price.dataset.price);if(x){$('manualPriceId').value=x.id;$('manualPriceValue').value=x.livePrice||'';$('manualPriceDate').value=today();$('manualPriceNote').value='';openModal('manualPriceModal')};return}
  const di=e.target.closest('[data-delete-investment]');if(di){const x=db.investments.find(q=>q.id===di.dataset.deleteInvestment);if(x&&confirm(`${x.name} silinsin mi?`)){if(x.purchaseExpenseId)removeExpenseRecord(x.purchaseExpenseId,true);db.investments=db.investments.filter(q=>q.id!==x.id);save();render();toast('Yatırım silindi')};return}
  const ov=e.target.closest('[data-open-vehicle]');if(ov){const v=db.vehicles.find(q=>q.id===ov.dataset.openVehicle);if(v)openVehicle(v);return}
  const dv=e.target.closest('[data-delete-vehicle]');if(dv){deleteVehicle(dv.dataset.deleteVehicle);return}
  const pb=e.target.closest('[data-pay-bill]');if(pb){payBill(pb.dataset.payBill);return}
  const dbill=e.target.closest('[data-delete-bill]');if(dbill){deleteBill(dbill.dataset.deleteBill);return}
  const reportBtn=e.target.closest('[data-report-month]');if(reportBtn){$('reportMonth').value=reportBtn.dataset.reportMonth;renderReports();return}
});

// Quick actions
$('quickIncome').onclick=()=>openIncome();$('quickAccount').onclick=()=>openAccount();$('quickMember').onclick=()=>openMember();$('refreshWeather').onclick=refreshWeather;
function openMember(){$('memberForm').reset();openModal('memberModal')}
function openAccount(){$('accountForm').reset();$('accountBalance').value='0';openModal('accountModal')}
function openIncome(){fillMembers('incomeMember');fillAccounts('incomeAccount','Hesaba ekle');$('incomeDate').value=today();$('incomeForm').reset();fillMembers('incomeMember');fillAccounts('incomeAccount','Hesaba ekle');$('incomeDate').value=today();openModal('incomeModal')}
$('openMembers').onclick=()=>{const body=db.members.length?db.members.map(m=>`<div class="item"><span>${esc(m)}</span><button data-remove-member="${esc(m)}">Sil</button></div>`).join(''):'<div class="empty">Üye yok.</div>';$('listTitle').textContent='Üyeler';$('listBody').innerHTML=body;$('listAdd').onclick=()=>{closeModal('listModal');openMember()};openModal('listModal')};
$('openAccounts').onclick=()=>{const body=db.accounts.length?db.accounts.map(a=>`<div class="item"><span><b>${esc(a.name)}</b><small>${a.type==='cash'?'Nakit':a.type==='bank'?'Banka':'Kredi Kartı'}</small></span><span><b>${money(a.balance,a.currency)}</b><button data-delete-account="${a.id}">Sil</button></span></div>`).join(''):'<div class="empty">Hesap yok.</div>';$('listTitle').textContent='Hesaplar';$('listBody').innerHTML=body;$('listAdd').onclick=()=>{closeModal('listModal');openAccount()};openModal('listModal')};
$('openSettings').onclick=()=>{renderSettings();openModal('settingsModal')};
$('exportData').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download=`aile-finans-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Yedek indirildi')};
$('importDataBtn').onclick=()=>$('importData').click();$('importData').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x||!Array.isArray(x.accounts)||!Array.isArray(x.expenses))throw Error();db={...structuredClone(base),...x};normalize();save();render();toast('Yedek yüklendi')}catch{toast('Geçersiz yedek')}e.target.value=''};

// Members/accounts/income
$('memberForm').onsubmit=e=>{e.preventDefault();const name=$('memberName').value.trim();if(!name)return;if(db.members.includes(name)){toast('Bu üye zaten var');return}db.members.push(name);save();closeModal('memberModal');render();toast('Üye eklendi')};
$('accountForm').onsubmit=e=>{e.preventDefault();const name=$('accountName').value.trim(),balance=Number($('accountBalance').value)||0;if(!name)return;db.accounts.push({id:uid(),name,type:$('accountType').value,balance,currency:$('accountCurrency').value,initialBalance:balance});save();closeModal('accountModal');render();toast('Hesap eklendi')};
document.addEventListener('click',e=>{const x=e.target.closest('[data-delete-account]');if(!x)return;const a=accountById(x.dataset.deleteAccount);if(!a)return;const used=db.expenses.some(q=>q.accountId===a.id)||db.incomes.some(q=>q.accountId===a.id)||db.fuelLogs.some(q=>q.accountId===a.id)||db.serviceLogs.some(q=>q.accountId===a.id)||db.documentLogs.some(q=>q.accountId===a.id)||db.bills.some(q=>q.accountId===a.id);if(used){toast('Bu hesapta kayıtlı hareketler var. Önce hareketleri taşı veya sil.');return}if(confirm(`${a.name} silinsin mi?`)){db.accounts=db.accounts.filter(q=>q.id!==a.id);save();render();closeModal('listModal');toast('Hesap silindi')}});
$('incomeForm').onsubmit=e=>{e.preventDefault();const amount=Number($('incomeAmount').value),currency=$('incomeCurrency').value,accountId=$('incomeAccount').value;if(!Number.isFinite(amount)||amount<=0){toast('Tutar girilmelidir');return}const a=accountById(accountId);if(a&&a.currency===currency)a.balance+=amount;db.incomes.push({id:uid(),title:$('incomeTitle').value.trim(),amount,currency,member:$('incomeMember').value,date:$('incomeDate').value||today(),accountId,note:$('incomeNote').value.trim()});save();closeModal('incomeModal');render();toast('Gelir eklendi')};

// Expenses
function prepareExpense(){fillMembers('expenseMember');$('expenseCategory').innerHTML=db.expenseCategories.map(c=>`<option>${esc(c)}</option>`).join('');fillAccounts('expenseAccount');$('expenseDate').value=today();openModal('expenseModal')}
$('addExpense').onclick=prepareExpense;
function openExpenseEdit(id){const x=db.expenses.find(q=>q.id===id);if(!x)return;editingExpenseId=id;$('expenseTitle').value=x.title;$('expenseAmount').value=x.amount;$('expenseCurrency').value=x.currency;fillMembers('expenseMember');$('expenseMember').value=x.member||'';$('expenseCategory').innerHTML=db.expenseCategories.map(c=>`<option>${esc(c)}</option>`).join('');$('expenseCategory').value=x.category;fillAccounts('expenseAccount');$('expenseAccount').value=x.accountId||'';$('expenseDate').value=x.date;$('expenseNote').value=x.note||'';openModal('expenseModal')}
$('expenseForm').onsubmit=e=>{e.preventDefault();const amount=Number($('expenseAmount').value),currency=$('expenseCurrency').value;if(!Number.isFinite(amount)||amount<=0)return toast('Tutar girilmelidir');if(editingExpenseId){const old=db.expenses.find(x=>x.id===editingExpenseId);if(!old)return;const nx={...old,title:$('expenseTitle').value.trim(),amount,currency,member:$('expenseMember').value,category:$('expenseCategory').value,accountId:$('expenseAccount').value,date:$('expenseDate').value||today(),note:$('expenseNote').value.trim()};nx.payment=accountById(nx.accountId)?.name||'';editExpenseBalance(old,nx);Object.assign(old,nx);editingExpenseId=null;save();closeModal('expenseModal');render();toast('Harcama güncellendi');return}addExpenseRecord({title:$('expenseTitle').value.trim(),amount,currency,member:$('expenseMember').value,category:$('expenseCategory').value,accountId:$('expenseAccount').value,date:$('expenseDate').value||today(),note:$('expenseNote').value.trim()});save();closeModal('expenseModal');render();toast('Harcama eklendi')};

// Investments
$('addInvestment').onclick=()=>{fillAccounts('investmentAccount');$('investmentForm').reset();$('investmentBuyDate').value=today();fillAccounts('investmentAccount');openModal('investmentModal')};
$('investmentForm').onsubmit=e=>{e.preventDefault();const qty=Number($('investmentQuantity').value),buy=Number($('investmentBuyPrice').value),accountId=$('investmentAccount').value;if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(buy)||buy<0)return toast('Miktar ve alış fiyatı girilmelidir');const x={id:uid(),type:$('investmentType').value,name:$('investmentName').value.trim(),symbol:$('investmentSymbol').value.trim(),quantity:qty,buyPrice:buy,currency:$('investmentCurrency').value,buyDate:$('investmentBuyDate').value||today(),note:$('investmentNote').value.trim(),livePrice:0,priceHistory:[],purchaseExpenseId:''};const cost=qty*buy;if(cost>0&&accountId){const e=addExpenseRecord({title:`Yatırım alımı: ${x.name}`,amount:cost,currency:x.currency,category:'Yatırım',accountId,date:x.buyDate,note:x.note,sourceType:'investment',sourceId:x.id});x.purchaseExpenseId=e?.id||''}db.investments.push(x);save();closeModal('investmentModal');render();navigate('investments');toast('Yatırım eklendi')};
$('manualPriceForm').onsubmit=e=>{e.preventDefault();const x=db.investments.find(q=>q.id===$('manualPriceId').value),price=Number($('manualPriceValue').value);if(!x||!Number.isFinite(price)||price<0)return;const date=$('manualPriceDate').value||today();x.livePrice=price;x.manualPriceAt=new Date().toISOString();x.priceHistory.push({date,price,note:$('manualPriceNote').value.trim()});save();closeModal('manualPriceModal');render();navigate('investments');toast('Fiyat güncellendi')};

// Vehicles
function fillVehicleAccounts(){fillAccounts('vehiclePurchaseAccount');fillAccounts('vehicleFuelAccount');fillAccounts('vehicleServiceAccount');fillAccounts('vehicleDocAccount')}
$('addVehicle').onclick=()=>{$('vehicleForm').reset();$('vehicleKm').value=0;$('vehiclePurchasePrice').value=0;$('vehiclePurchaseDate').value=today();fillVehicleAccounts();openModal('vehicleModal')};
$('vehicleForm').onsubmit=e=>{e.preventDefault();const name=$('vehicleName').value.trim();if(!name)return;const v={id:uid(),name,plate:$('vehiclePlate').value.trim(),fuel:$('vehicleFuel').value.trim(),km:Number($('vehicleKm').value)||0,purchasePrice:Number($('vehiclePurchasePrice').value)||0,purchaseDate:$('vehiclePurchaseDate').value||today()};const accountId=$('vehiclePurchaseAccount').value;if(v.purchasePrice>0&&accountId){const ex=addExpenseRecord({title:`Araç satın alma: ${v.name}`,amount:v.purchasePrice,category:'Araç',accountId,date:v.purchaseDate,sourceType:'vehicle',sourceId:v.id});v.purchaseExpenseId=ex?.id||''}db.vehicles.push(v);save();closeModal('vehicleModal');render();toast('Araç eklendi')};
function deleteVehicle(id){const v=db.vehicles.find(x=>x.id===id);if(!v)return;if(!confirm(`${v.name} ve tüm araç kayıtları silinsin mi?`))return;db.expenses.filter(x=>x.sourceType==='vehicle'&&x.sourceId===id).forEach(x=>removeExpenseRecord(x.id,true));db.vehicleLogs=db.vehicleLogs.filter(x=>x.vehicleId!==id);db.fuelLogs=db.fuelLogs.filter(x=>x.vehicleId!==id);db.serviceLogs=db.serviceLogs.filter(x=>x.vehicleId!==id);db.documentLogs=db.documentLogs.filter(x=>x.vehicleId!==id);db.vehicles=db.vehicles.filter(x=>x.id!==id);save();render();closeModal('vehicleDetailModal');toast('Araç silindi')}
$('vehicleAddKm').onclick=()=>{closeModal('vehicleDetailModal');$('vehicleKmValue').value=vehicleKm(db.vehicles.find(v=>v.id===activeVehicleId));$('vehicleKmDate').value=today();openModal('vehicleKmModal')};
$('vehicleAddFuel').onclick=()=>{closeModal('vehicleDetailModal');$('vehicleFuelForm').reset();$('vehicleFuelKm').value=vehicleKm(db.vehicles.find(v=>v.id===activeVehicleId));$('vehicleFuelDate').value=today();fillAccounts('vehicleFuelAccount');openModal('vehicleFuelModal')};
$('vehicleAddService').onclick=()=>{closeModal('vehicleDetailModal');$('vehicleServiceForm').reset();$('vehicleServiceKm').value=vehicleKm(db.vehicles.find(v=>v.id===activeVehicleId));$('vehicleServiceDate').value=today();fillAccounts('vehicleServiceAccount');openModal('vehicleServiceModal')};
$('vehicleAddDoc').onclick=()=>{closeModal('vehicleDetailModal');$('vehicleDocForm').reset();$('vehicleDocDate').value=today();$('vehicleDocExpiry').value=today();fillAccounts('vehicleDocAccount');openModal('vehicleDocModal')};
function updateFuelPrice(){$('vehicleFuelPrice').value=((Number($('vehicleFuelTotal').value)||0)/(Number($('vehicleFuelLiters').value)||1)).toFixed(2)}$('vehicleFuelTotal').oninput=updateFuelPrice;$('vehicleFuelLiters').oninput=updateFuelPrice;
$('vehicleKmForm').onsubmit=e=>{e.preventDefault();const v=db.vehicles.find(x=>x.id===activeVehicleId),km=Number($('vehicleKmValue').value);if(!v||km<0)return;v.km=Math.max(v.km,km);db.vehicleLogs.push({id:uid(),vehicleId:v.id,km,date:$('vehicleKmDate').value||today()});save();closeModal('vehicleKmModal');render();openVehicle(v)};
$('vehicleFuelForm').onsubmit=e=>{e.preventDefault();const v=db.vehicles.find(x=>x.id===activeVehicleId),liters=Number($('vehicleFuelLiters').value),total=Number($('vehicleFuelTotal').value),km=Number($('vehicleFuelKm').value),accountId=$('vehicleFuelAccount').value;if(!v||liters<=0||total<=0||km<0)return;const ex=addExpenseRecord({title:`Yakıt: ${v.name}`,amount:total,category:'Yakıt',accountId,date:$('vehicleFuelDate').value||today(),sourceType:'vehicle',sourceId:v.id});db.fuelLogs.push({id:uid(),vehicleId:v.id,liters,total,price:total/liters,km,accountId,date:$('vehicleFuelDate').value||today(),expenseId:ex?.id||''});v.km=Math.max(v.km,km);save();closeModal('vehicleFuelModal');render();openVehicle(v);toast('Yakıt kaydedildi')};
$('vehicleServiceForm').onsubmit=e=>{e.preventDefault();const v=db.vehicles.find(x=>x.id===activeVehicleId),cost=Number($('vehicleServiceCost').value)||0,km=Number($('vehicleServiceKm').value)||0,accountId=$('vehicleServiceAccount').value;if(!v||cost<0)return;const ex=cost?addExpenseRecord({title:`Bakım: ${$('vehicleServiceTitle').value.trim()}`,amount:cost,category:'Araç',accountId,date:$('vehicleServiceDate').value||today(),sourceType:'vehicle',sourceId:v.id,note:$('vehicleServiceNote').value.trim()}):null;db.serviceLogs.push({id:uid(),vehicleId:v.id,title:$('vehicleServiceTitle').value.trim(),cost,km,nextKm:Number($('vehicleServiceNextKm').value)||0,accountId,date:$('vehicleServiceDate').value||today(),expenseId:ex?.id||''});v.km=Math.max(v.km,km);save();closeModal('vehicleServiceModal');render();openVehicle(v);toast('Bakım kaydedildi')};
$('vehicleDocForm').onsubmit=e=>{e.preventDefault();const v=db.vehicles.find(x=>x.id===activeVehicleId),cost=Number($('vehicleDocCost').value)||0,accountId=$('vehicleDocAccount').value;if(!v)return;const ex=cost?addExpenseRecord({title:`${$('vehicleDocType').value}: ${v.name}`,amount:cost,category:'Araç',accountId,date:$('vehicleDocDate').value||today(),sourceType:'vehicle',sourceId:v.id}):null;db.documentLogs.push({id:uid(),vehicleId:v.id,type:$('vehicleDocType').value,cost,date:$('vehicleDocDate').value,expiry:$('vehicleDocExpiry').value,accountId,expenseId:ex?.id||''});save();closeModal('vehicleDocModal');render();openVehicle(v);toast('Belge kaydedildi')};

// Bills
$('addBill').onclick=()=>{fillAccounts('billAccount');$('billForm').reset();$('billDueDate').value=today();fillAccounts('billAccount');openModal('billModal')};
$('billForm').onsubmit=e=>{e.preventDefault();const id=$('billId').value;const data={id:id||uid(),name:$('billName').value.trim(),category:$('billCategory').value,amount:Number($('billAmount').value),dueDate:$('billDueDate').value||today(),recurring:$('billRecurring').checked,accountId:$('billAccount').value,paid:false,paidExpenseId:''};if(!data.name||data.amount<=0)return;const old=db.bills.find(x=>x.id===id);if(old){Object.assign(old,data)}else db.bills.push(data);save();closeModal('billModal');render();toast('Fatura kaydedildi')};
function payBill(id){const b=db.bills.find(x=>x.id===id);if(!b||b.paid)return;if(!b.accountId){toast('Ödeme hesabı seçilmemiş');return}const ex=addExpenseRecord({title:`Fatura: ${b.name}`,amount:b.amount,category:'Fatura',accountId:b.accountId,date:today(),sourceType:'bill',sourceId:b.id});if(!ex)return;b.paid=true;b.paidAt=today();b.paidExpenseId=ex.id;save();render();toast('Fatura ödendi ve giderlere işlendi')}
function deleteBill(id){const b=db.bills.find(x=>x.id===id);if(!b)return;if(!confirm(`${b.name} silinsin mi?`))return;if(b.paidExpenseId)removeExpenseRecord(b.paidExpenseId,true);db.bills=db.bills.filter(x=>x.id!==id);save();render();toast('Fatura silindi')}

// Reports/settings
$('reportMember').onchange=renderReports;$('reportMonth').onchange=renderReports;
$('settingsForm').onsubmit=e=>{e.preventDefault();db.settings.appName=$('settingAppName').value.trim()||'Aile Finans';db.settings.currency=$('settingCurrency').value;db.settings.theme=$('settingTheme').value;db.settings.city=$('settingCity').value.trim()||'Antalya';db.expenseCategories=$('settingCategories').value.split(',').map(x=>x.trim()).filter(Boolean);save();render();closeModal('settingsModal');toast('Ayarlar kaydedildi')};
$('clearData').onclick=()=>{if(!confirm('Tüm finans verileri silinecek. Bu işlem geri alınamaz.'))return;const settings=db.settings;db={...structuredClone(base),settings};save();render();toast('Tüm veriler silindi')};

// Initial state and boot tests
migrate();applyTheme();render();navigate('home');refreshWeather();
window.AileFinans={getState:()=>structuredClone(db),render,navigate,addExpenseRecord,payBill,deleteBill,deleteVehicle,fuelStats,refreshWeather,openVehicle};
})();
