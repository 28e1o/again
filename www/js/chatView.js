// ===================================================================
// chatView.js — layar chat: header, latar, bio, font, cari pesan
// ===================================================================

function openChat(chatId){
  state.currentChatId = chatId;
  const chat = getCurrentChat();
  if(!chat) return;

  closeChatSearch(); // reset pencarian tiap buka chat baru

  renderChatHeaderIdentity();
  renderChatBackground();
  renderBioBanner();
  renderChatFontStyle();
  document.getElementById('chat-header-role').textContent = 'online';
  renderMessages();
  showScreen('screen-chat');

  // pulihkan draft yang tersimpan otomatis
  const input = document.getElementById('msg-input');
  input.value = chat.draft || '';

  // chat ini sudah "dibaca" — bersihkan badge unread-nya
  chat.lastOpenedAt = Date.now();
  saveState();

  setTimeout(() => input.focus(), 200);
}

function leaveChatScreen(){
  showScreen('screen-home');
  renderChatList();
  document.body.style.setProperty('--action-color', appPrefs.actionColor);
}

// Header SELALU menampilkan identitas lawan bicara (foto, warna, nama),
// bukan peran yang sedang kamu mainkan. Peran aktif ('activeRoleId') cuma
// menentukan sudut pandang bubble chat (kiri/kanan), bukan siapa yang
// ditampilkan di header — persis seperti aplikasi chat pada umumnya.
function renderChatHeaderIdentity(){
  const chat = getCurrentChat();
  const avatarEl = document.getElementById('chat-header-avatar');
  const nameEl = document.getElementById('chat-header-name');

  if(chat.type === 'group'){
    // Grup: header SELALU pakai foto/nama grup itu sendiri (bisa dikustom
    // lewat Pengaturan), bukan foto anggota atau foto pemain (kamu).
    avatarEl.style.background = chat.color;
    avatarEl.innerHTML = chat.avatarUrl
      ? `<img src="${chat.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
      : initials(chat.name);
    nameEl.textContent = chat.name;
    return;
  }

  // Chat 1v1: cari peran bertipe 'other' (lawan bicara/karakter),
  // bukan peran yang sedang aktif dimainkan.
  const role = otherRoles(chat)[0] || chat.roles.find(r => r.id !== chat.activeRoleId) || chat.roles[0] || {};
  avatarEl.style.background = role.color || chat.color;
  avatarEl.innerHTML = role.avatarUrl
    ? `<img src="${role.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : initials(role.name || chat.name);
  nameEl.textContent = role.name || chat.name;
}

function renderChatBackground(){
  const chat = getCurrentChat();
  const layer = document.getElementById('chat-bg-layer');
  if(chat.background && chat.background.imageUrl){
    layer.style.backgroundImage = `url(${chat.background.imageUrl})`;
    layer.style.opacity = chat.background.opacity ?? 1;
  } else {
    layer.style.backgroundImage = 'none';
    layer.style.opacity = 0;
  }
}

// Bio yang tampil mengikuti peran yang sedang aktif (deskripsi karakter
// saat memerankan karakter, bio persona kamu saat memerankan dirimu).
function renderBioBanner(){
  const chat = getCurrentChat();
  const banner = document.getElementById('bio-banner');
  const role = chat.roles.find(r => r.id === chat.activeRoleId);
  const bio = (role && role.bio) || '';
  if(bio && bio.trim()){
    banner.textContent = bio.trim();
    banner.classList.add('active');
  } else {
    banner.textContent = '';
    banner.classList.remove('active');
  }
}

const FONT_FAMILY_MAP = {
  system: '',
  serif: '"Georgia","Times New Roman",serif',
  rounded: '"Segoe Print","Comic Sans MS",cursive',
  mono: '"Courier New",monospace'
};

function renderChatFontStyle(){
  const chat = getCurrentChat();
  const box = document.getElementById('messages');
  box.style.setProperty('--chat-font-size', (chat.fontSize || 15) + 'px');
  box.style.setProperty('--chat-font-family', FONT_FAMILY_MAP[chat.fontFamily] || 'inherit');
  // di-set di body juga supaya berlaku ke modal (mis. tombol "Hapus" di menu aksi),
  // yang letaknya di luar #messages di DOM.
  document.body.style.setProperty('--action-color', chat.actionColor || appPrefs.actionColor);
}

// ---------------------------------------------------------------
// Cari pesan di dalam chat yang sedang dibuka
// ---------------------------------------------------------------
let chatSearchHits = [];
let chatSearchIdx = -1;

function initChatSearch(){
  document.getElementById('btn-chat-search').addEventListener('click', () => {
    const bar = document.getElementById('chat-search-bar');
    bar.classList.toggle('active');
    if(bar.classList.contains('active')) document.getElementById('chat-search-input').focus();
    else closeChatSearch();
  });
  document.getElementById('chat-search-input').addEventListener('input', debounce(runChatSearch, 150));
  document.getElementById('chat-search-prev').addEventListener('click', () => stepChatSearch(-1));
  document.getElementById('chat-search-next').addEventListener('click', () => stepChatSearch(1));
  document.getElementById('chat-search-close').addEventListener('click', closeChatSearch);
}

function closeChatSearch(){
  document.getElementById('chat-search-bar').classList.remove('active');
  document.getElementById('chat-search-input').value = '';
  document.getElementById('chat-search-count').textContent = '';
  chatSearchHits = [];
  chatSearchIdx = -1;
}

function runChatSearch(){
  const chat = getCurrentChat();
  const q = document.getElementById('chat-search-input').value.trim().toLowerCase();
  const countEl = document.getElementById('chat-search-count');
  if(!q || !chat){ chatSearchHits = []; countEl.textContent = ''; return; }
  chatSearchHits = chat.messages.filter(m => (m.text||'').toLowerCase().includes(q)).map(m => m.id);
  chatSearchIdx = chatSearchHits.length ? 0 : -1;
  countEl.textContent = chatSearchHits.length ? `${chatSearchIdx+1}/${chatSearchHits.length}` : 'Tidak ditemukan';
  if(chatSearchIdx >= 0) scrollToMessage(chatSearchHits[chatSearchIdx]);
}

function stepChatSearch(dir){
  if(chatSearchHits.length === 0) return;
  chatSearchIdx = (chatSearchIdx + dir + chatSearchHits.length) % chatSearchHits.length;
  document.getElementById('chat-search-count').textContent = `${chatSearchIdx+1}/${chatSearchHits.length}`;
  scrollToMessage(chatSearchHits[chatSearchIdx]);
}
