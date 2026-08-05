// ===================================================================
// home.js — daftar chat (pin, unread, cari) + tab statistik
// ===================================================================

let homeSearchQuery = '';
let longPressChatTarget = null; // chat sedang ditekan-tahan di daftar (untuk menu pin/hapus)

function lastActivity(chat){
  if(chat.messages.length === 0) return 0;
  return chat.messages[chat.messages.length-1].time;
}

function unreadCount(chat){
  if(chat.messages.length === 0) return 0;
  return chat.messages.filter(m => m.time > (chat.lastOpenedAt || 0)).length;
}

function previewFor(chat, msg){
  if(msg.isNarration) return '📝 ' + (msg.text || 'Narasi');
  const role = chat.roles.find(r => r.id === msg.roleId);
  const sender = role ? role.name : '?';
  const isActive = msg.roleId === chat.activeRoleId;
  const label = isActive ? '' : `${sender}: `;
  const mtype = msg.media ? (msg.media.type === 'video' ? '🎥 Video' : msg.media.type === 'audio' ? '🎤 Pesan suara' : '📷 Foto') : '';
  const body = msg.media ? mtype + (msg.text ? ' · ' + msg.text : '') : msg.text;
  return label + body;
}

function renderChatList(){
  const list = document.getElementById('chat-list');
  list.innerHTML = '';

  let chats = [...state.chats];
  if(homeSearchQuery.trim()){
    const q = homeSearchQuery.trim().toLowerCase();
    chats = chats.filter(c => c.name.toLowerCase().includes(q));
  }

  if(state.chats.length === 0){
    list.innerHTML = `<div class="empty-state">Belum ada karakter atau grup.<br>Tekan tombol <b>+</b> di kanan bawah untuk mulai roleplay.</div>`;
    return;
  }
  if(chats.length === 0){
    list.innerHTML = `<div class="empty-state">Tidak ada chat yang cocok dengan "${escapeHtml(homeSearchQuery)}".</div>`;
    return;
  }

  const sorted = chats.sort((a,b) => {
    if(!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return lastActivity(b) - lastActivity(a);
  });

  sorted.forEach(chat => {
    const row = document.createElement('div');
    row.className = 'chat-row';
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg ? previewFor(chat, lastMsg) : 'Belum ada pesan';
    const time = lastMsg ? formatTime(lastMsg.time) : '';
    const unread = unreadCount(chat);

    row.innerHTML = `
      ${chat.pinned ? '<div class="pin-flag">📌</div>' : ''}
      <div class="avatar ${chat.type==='group'?'group':''}" style="background:${chat.color}">
        ${chat.avatarUrl ? `<img src="${chat.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : initials(chat.name)}
      </div>
      <div class="chat-row-body">
        <div class="chat-row-top">
          <span class="chat-row-name">${escapeHtml(chat.name)}</span>
          <span class="chat-row-time">${time}</span>
        </div>
        <div class="chat-row-preview">${escapeHtml(preview)}</div>
      </div>
      ${unread > 0 ? `<div class="unread-badge">${unread > 99 ? '99+' : unread}</div>` : ''}
    `;
    row.addEventListener('click', () => openChat(chat.id));

    // tekan-tahan: menu pin / hapus chat
    let lpTimer = null;
    const startLp = () => { lpTimer = setTimeout(() => openChatRowMenu(chat), 420); };
    const cancelLp = () => { if(lpTimer){ clearTimeout(lpTimer); lpTimer = null; } };
    row.addEventListener('pointerdown', startLp);
    row.addEventListener('pointerup', cancelLp);
    row.addEventListener('pointerleave', cancelLp);
    row.addEventListener('pointercancel', cancelLp);

    list.appendChild(row);
  });
}

function openChatRowMenu(chat){
  longPressChatTarget = chat;
  document.getElementById('chat-menu-pin-label').textContent = chat.pinned ? 'Lepas Pin' : 'Sematkan (Pin)';
  openModal('modal-chat-row-menu');
}

function handleTogglePinFromMenu(){
  if(!longPressChatTarget) return;
  longPressChatTarget.pinned = !longPressChatTarget.pinned;
  saveState();
  closeModal('modal-chat-row-menu');
  renderChatList();
}

function handleDeleteChatFromMenu(){
  if(!longPressChatTarget) return;
  const chat = longPressChatTarget;
  closeModal('modal-chat-row-menu');
  if(!confirm(`Hapus chat "${chat.name}"? Semua pesan di dalamnya akan hilang permanen dan tidak bisa dikembalikan.`)) return;
  state.chats = state.chats.filter(c => c.id !== chat.id);
  deleteChatMedia(chat);
  saveState();
  renderChatList();
}

// ---------------------------------------------------------------
// Pencarian chat di halaman utama (filter berdasarkan nama)
// ---------------------------------------------------------------
function initHomeSearch(){
  const bar = document.getElementById('home-search-bar');
  const input = document.getElementById('home-search-input');
  document.getElementById('btn-search').addEventListener('click', () => {
    bar.classList.toggle('active');
    if(bar.classList.contains('active')) input.focus();
    else { homeSearchQuery = ''; input.value = ''; renderChatList(); }
  });
  input.addEventListener('input', debounce(() => {
    homeSearchQuery = input.value;
    renderChatList();
  }, 120));
}

// ---------------------------------------------------------------
// Tab Chats / Statistik
// ---------------------------------------------------------------
function initHomeTabs(){
  document.getElementById('tab-chats').addEventListener('click', () => setHomeTab('chats'));
  document.getElementById('tab-stats').addEventListener('click', () => setHomeTab('stats'));
}

function setHomeTab(tab){
  document.getElementById('tab-chats').classList.toggle('active', tab === 'chats');
  document.getElementById('tab-stats').classList.toggle('active', tab === 'stats');
  document.getElementById('chat-list').style.display = tab === 'chats' ? '' : 'none';
  document.getElementById('stats-panel').style.display = tab === 'stats' ? '' : 'none';
  document.getElementById('btn-fab').style.display = tab === 'chats' ? '' : 'none';
  if(tab === 'stats') renderStats();
}

function renderStats(){
  const panel = document.getElementById('stats-panel');
  if(state.chats.length === 0){
    panel.innerHTML = `<div class="empty-state">Belum ada data. Statistik akan muncul setelah kamu punya chat dan pesan.</div>`;
    return;
  }

  let totalMsg = 0, totalWords = 0, totalMedia = 0;
  const perChat = state.chats.map(chat => {
    let msgCount = chat.messages.length;
    let words = 0, media = 0;
    chat.messages.forEach(m => { words += wordCount(m.text); if(m.media) media++; });
    totalMsg += msgCount; totalWords += words; totalMedia += media;
    return { chat, msgCount, words };
  }).sort((a,b) => b.msgCount - a.msgCount);

  const maxMsg = Math.max(1, ...perChat.map(p => p.msgCount));

  panel.innerHTML = `
    <div class="stats-summary">
      <div class="stats-card"><div class="stats-num">${state.chats.length}</div><div class="stats-label">Total Chat</div></div>
      <div class="stats-card"><div class="stats-num">${totalMsg}</div><div class="stats-label">Total Pesan</div></div>
      <div class="stats-card"><div class="stats-num">${totalWords}</div><div class="stats-label">Total Kata</div></div>
      <div class="stats-card"><div class="stats-num">${totalMedia}</div><div class="stats-label">Foto/Video</div></div>
    </div>
    <div class="stats-section-title">Chat paling aktif</div>
    <div class="stats-bars">
      ${perChat.map(p => `
        <div class="stats-bar-row">
          <div class="stats-bar-name">${escapeHtml(p.chat.name)}</div>
          <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${Math.round(p.msgCount/maxMsg*100)}%; background:${p.chat.color}"></div></div>
          <div class="stats-bar-val">${p.msgCount} pesan · ${p.words} kata</div>
        </div>
      `).join('')}
    </div>
  `;
}
