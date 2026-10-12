/* ===== データ管理 ===== */
const STORAGE_KEY = 'rewardTrackerData_v1';
const DAY_LABELS = ['日','月','火','水','木','金','土'];

function defaultData() {
  return {
    tasks: [
      { id: uid(), name: 'ランニング2km（休日）', points: 20, days: [] },
      { id: uid(), name: 'ウォーキング30分（出勤日）', points: 10, days: [] },
      { id: uid(), name: '自制（我慢）', points: 15, days: [2, 5] },
      { id: uid(), name: '毎食腹8分目', points: 10, days: [] },
      { id: uid(), name: '水2L飲む', points: 10, days: [] },
      { id: uid(), name: '週1冊読書', points: 30, days: [0] },
      { id: uid(), name: '読書紹介文作成', points: 20, days: [0] },
      { id: uid(), name: 'プロテイン1日1回', points: 5, days: [] }
    ],
    rewards: [
      { id: uid(), name: '例：コンビニスイーツ', cost: 50 },
      { id: uid(), name: '例：ご褒美ごはん', cost: 500 },
      { id: uid(), name: '例：旅行', cost: 5000 }
    ],
    logs: [],
    completions: {},
    balance: 0,
    settings: { notifyEnabled: false, notifyTime: '08:00', lastFired: null }
  };
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

let data = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultData(), parsed);
  } catch (e) {
    console.error('load error', e);
    return defaultData();
  }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function todayKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function todayWeekday() { return new Date().getDay(); }

/* ===== 画面切り替え ===== */
const views = document.querySelectorAll('.view');
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

function switchView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'rewards') renderRewards();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
}

/* ===== 今日のタスク ===== */
function renderToday() {
  document.getElementById('balanceValue').textContent = data.balance;
  const dateLabel = document.getElementById('todayDateLabel');
  const now = new Date();
  dateLabel.textContent = `今日のタスク（${now.getMonth()+1}/${now.getDate()} ${DAY_LABELS[now.getDay()]}）`;

  const key = todayKey();
  const doneList = data.completions[key] || [];
  const wd = todayWeekday();
  const todaysTasks = data.tasks.filter(t => !t.days || t.days.length === 0 || t.days.includes(wd));

  const ul = document.getElementById('todayTaskList');
  ul.innerHTML = '';
  document.getElementById('todayEmptyHint').style.display = todaysTasks.length ? 'none' : 'block';

  todaysTasks.forEach(t => {
    const done = doneList.includes(t.id);
    const li = document.createElement('li');
    li.className = 'task-item' + (done ? ' done' : '');
    li.innerHTML = `
      <div class="task-check">✓</div>
      <div class="task-main">
        <div class="task-name">${escapeHtml(t.name)}</div>
        <div class="task-points">+${t.points}pt</div>
      </div>`;
    li.addEventListener('click', () => toggleTask(t.id));
    ul.appendChild(li);
  });
}

function toggleTask(taskId) {
  const key = todayKey();
  if (!data.completions[key]) data.completions[key] = [];
  const list = data.completions[key];
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  const idx = list.indexOf(taskId);
  if (idx === -1) {
    list.push(taskId);
    data.balance += task.points;
    data.logs.unshift({ id: uid(), date: new Date().toISOString(), type: 'task', name: task.name, points: task.points, balance: data.balance });
  } else {
    list.splice(idx, 1);
    data.balance -= task.points;
    data.logs.unshift({ id: uid(), date: new Date().toISOString(), type: 'task_undo', name: task.name + '（取消）', points: -task.points, balance: data.balance });
  }
  saveData();
  renderToday();
}

/* ===== ご褒美 ===== */
function renderRewards() {
  document.getElementById('balanceValue').textContent = data.balance;
  const ul = document.getElementById('rewardList');
  ul.innerHTML = '';
  data.rewards.slice().sort((a,b)=>a.cost-b.cost).forEach(r => {
    const li = document.createElement('li');
    li.className = 'reward-item';
    const can = data.balance >= r.cost;
    li.innerHTML = `
      <div class="reward-main">
        <div class="reward-name">${escapeHtml(r.name)}</div>
        <div class="reward-cost">${r.cost} pt</div>
        <button class="reward-del" data-id="${r.id}">削除</button>
      </div>
      <button class="redeem-btn" data-id="${r.id}" ${can ? '' : 'disabled'}>交換</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => redeemReward(b.dataset.id)));
  ul.querySelectorAll('.reward-del').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); deleteReward(b.dataset.id); }));
}

function redeemReward(id) {
  const r = data.rewards.find(x => x.id === id);
  if (!r || data.balance < r.cost) return;
  if (!confirm(`「${r.name}」に ${r.cost}pt を使って交換しますか？`)) return;
  data.balance -= r.cost;
  data.logs.unshift({ id: uid(), date: new Date().toISOString(), type: 'redeem', name: r.name, points: -r.cost, balance: data.balance });
  saveData();
  renderRewards();
}

function deleteReward(id) {
  if (!confirm('このご褒美を削除しますか？')) return;
  data.rewards = data.rewards.filter(r => r.id !== id);
  saveData();
  renderRewards();
}

document.getElementById('addRewardBtn').addEventListener('click', () => openRewardModal());

function openRewardModal() {
  openModal(`
    <h3>ご褒美を追加</h3>
    <label>名前</label>
    <input type="text" id="m-reward-name" placeholder="例：焼肉ディナー">
    <label>必要ポイント</label>
    <input type="number" id="m-reward-cost" value="100" min="1">
    <div class="modal-actions">
      <button class="cancel-btn" id="m-cancel">キャンセル</button>
      <button class="save-btn" id="m-save">追加</button>
    </div>
  `);
  document.getElementById('m-cancel').addEventListener('click', closeModal);
  document.getElementById('m-save').addEventListener('click', () => {
    const name = document.getElementById('m-reward-name').value.trim();
    const cost = parseInt(document.getElementById('m-reward-cost').value, 10);
    if (!name || !cost || cost <= 0) { alert('名前と正しいポイント数を入力してください'); return; }
    data.rewards.push({ id: uid(), name, cost });
    saveData();
    closeModal();
    renderRewards();
  });
}

/* ===== 履歴 ===== */
function renderHistory() {
  const ul = document.getElementById('historyList');
  ul.innerHTML = '';
  document.getElementById('historyEmptyHint').style.display = data.logs.length ? 'none' : 'block';
  data.logs.slice(0, 200).forEach(log => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const d = new Date(log.date);
    const dateStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const sign = log.points >= 0 ? 'plus' : 'minus';
    const prefix = log.points >= 0 ? '+' : '';
    li.innerHTML = `
      <div class="h-left"><div>${escapeHtml(log.name)}</div><div class="h-date">${dateStr}</div></div>
      <div class="h-points ${sign}">${prefix}${log.points}pt</div>`;
    ul.appendChild(li);
  });
}

/* ===== 設定：タスク管理 ===== */
function renderSettings() {
  const ul = document.getElementById('taskSettingsList');
  ul.innerHTML = '';
  data.tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item';
    const daysLabel = (!t.days || t.days.length === 0) ? '毎日' : t.days.sort().map(d => DAY_LABELS[d]).join('・');
    li.innerHTML = `
      <div class="task-main">
        <div class="task-name">${escapeHtml(t.name)}</div>
        <div class="task-points">+${t.points}pt</div>
        <div class="task-days">${daysLabel}</div>
      </div>
      <button class="settings-del" data-id="${t.id}">削除</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.settings-del').forEach(b => b.addEventListener('click', () => deleteTask(b.dataset.id)));

  document.getElementById('notifyEnabled').checked = data.settings.notifyEnabled;
  document.getElementById('notifyTime').value = data.settings.notifyTime;
  updateNotifyStatus();
}

function deleteTask(id) {
  if (!confirm('このタスクを削除しますか？')) return;
  data.tasks = data.tasks.filter(t => t.id !== id);
  saveData();
  renderSettings();
}

document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());

function openTaskModal() {
  openModal(`
    <h3>タスクを追加</h3>
    <label>名前</label>
    <input type="text" id="m-task-name" placeholder="例：腹筋20回">
    <label>ポイント</label>
    <input type="number" id="m-task-points" value="10" min="1">
    <label>実施する曜日（未選択＝毎日）</label>
    <div class="days-row" id="m-days-row">
      ${DAY_LABELS.map((lbl, i) => `<button type="button" class="day-chip" data-day="${i}">${lbl}</button>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="cancel-btn" id="m-cancel">キャンセル</button>
      <button class="save-btn" id="m-save">追加</button>
    </div>
  `);
  const selectedDays = new Set();
  document.querySelectorAll('#m-days-row .day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const d = parseInt(chip.dataset.day, 10);
      if (selectedDays.has(d)) { selectedDays.delete(d); chip.classList.remove('selected'); }
      else { selectedDays.add(d); chip.classList.add('selected'); }
    });
  });
  document.getElementById('m-cancel').addEventListener('click', closeModal);
  document.getElementById('m-save').addEventListener('click', () => {
    const name = document.getElementById('m-task-name').value.trim();
    const points = parseInt(document.getElementById('m-task-points').value, 10);
    if (!name || !points || points <= 0) { alert('名前と正しいポイント数を入力してください'); return; }
    data.tasks.push({ id: uid(), name, points, days: Array.from(selectedDays) });
    saveData();
    closeModal();
    renderSettings();
    renderToday();
  });
}

/* ===== モーダル共通 ===== */
const modalOverlay = document.getElementById('modalOverlay');
const modalBox = document.getElementById('modalBox');
function openModal(html) { modalBox.innerHTML = html; modalOverlay.classList.add('active'); }
function closeModal() { modalOverlay.classList.remove('active'); modalBox.innerHTML = ''; }
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

/* ===== 通知 ===== */
document.getElementById('notifyEnabled').addEventListener('change', (e) => {
  data.settings.notifyEnabled = e.target.checked;
  saveData();
  updateNotifyStatus();
});
document.getElementById('notifyTime').addEventListener('change', (e) => {
  data.settings.notifyTime = e.target.value;
  saveData();
});
document.getElementById('enableNotifyBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) { alert('この環境では通知が使えません'); return; }
  const perm = await Notification.requestPermission();
  updateNotifyStatus();
  if (perm === 'granted') {
    new Notification('通知が有効になりました', { body: '設定した時刻に今日のタスクをお知らせします。', icon: 'icons/icon-192.png' });
  }
});

function updateNotifyStatus() {
  const el = document.getElementById('notifyStatus');
  if (!('Notification' in window)) { el.textContent = 'この環境では通知APIが使えません。'; return; }
  const perm = Notification.permission;
  if (perm === 'granted') el.textContent = '通知は許可されています。アプリをホーム画面に追加しておくと確実です。';
  else if (perm === 'denied') el.textContent = '通知がブロックされています。設定アプリから許可してください。';
  else el.textContent = '「通知を許可する」を押して許可してください。';
}

/* アプリが開いている間、設定時刻になったら通知を出す（簡易版）
   ※iPhoneでアプリを閉じている間も確実に通知するにはサーバー配信のPush通知が必要です。
     ホーム画面に追加した状態でこのアプリをバックグラウンドでも開いたままにしておくと動作します。 */
setInterval(() => {
  if (!data.settings.notifyEnabled) return;
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const key = todayKey() + '_' + hhmm;
  if (hhmm === data.settings.notifyTime && data.settings.lastFired !== key) {
    data.settings.lastFired = key;
    saveData();
    new Notification('今日のタスクをチェックしよう', { body: 'タップしてタスク一覧を開く', icon: 'icons/icon-192.png' });
  }
}, 30000);

/* ===== バックアップ ===== */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reward-tracker-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('loadSampleBtn') && document.getElementById('loadSampleBtn').addEventListener('click', async () => {
  if (!confirm('現在のデータを置き換えて、初期タスク一式を読み込みます。よろしいですか？')) return;
  try {
    const res = await fetch('./initial-data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const imported = await res.json();
    data = Object.assign(defaultData(), imported);
    saveData();
    renderToday(); renderRewards(); renderHistory(); renderSettings();
    alert('読み込みました');
  } catch (err) {
    alert('読み込みに失敗しました：' + err.message);
  }
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!confirm('現在のデータを置き換えます。よろしいですか？')) return;
      data = Object.assign(defaultData(), imported);
      saveData();
      renderToday(); renderRewards(); renderHistory(); renderSettings();
      alert('読み込みました');
    } catch (err) { alert('読み込みに失敗しました：' + err.message); }
  };
  reader.readAsText(file);
});

/* ===== ユーティリティ ===== */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ===== 初期化 ===== */
renderToday();
updateNotifyStatus();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(err => console.error('SW登録失敗', err));
}
