// ===================================================================
// RP Chat — aplikasi roleplay bergaya Messenger
// Semua data disimpan di localStorage, murni client-side.
// ===================================================================

const STORAGE_KEY = 'rp_chats_v1';
const AVATAR_COLORS = ['#6b7fd7','#f97aa1','#3ecf8e','#f2a94e','#a06bd7','#e5555f','#4ba3c3','#8f9a3c'];

let state = {
  chats: [],        // {id, type:'character'|'group', name, color, roles:[{id,name,type,color}], activeRoleId, messages:[{id,roleId,text,time}]}
  currentChatId: null
};

// ---------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ state.chats = JSON.parse(raw); }
  }catch(e){ console.error('Gagal memuat data', e); state.chats = []; }

  // migrasi data lama yang belum punya field kustomisasi
  state.chats.forEach(chat => {
    if(chat.avatarUrl === undefined) chat.avatarUrl = null;
    if(!chat.myBubbleColor) chat.myBubbleColor = '#0084ff';
    if(!chat.background) chat.background = { imageUrl: null, opacity: 1 };
    if(chat.bio === undefined) chat.bio = '';
    if(!chat.fontFamily) chat.fontFamily = 'system';
    if(!chat.fontSize) chat.fontSize = 15;
    if(chat.roles){
      chat.roles.forEach(r => { if(r.avatarUrl === undefined) r.avatarUrl = null; });
      const charRole = chat.roles.find(r => r.type === 'other');
      if(chat.avatarUrl && charRole && !charRole.avatarUrl) charRole.avatarUrl = chat.avatarUrl;
    }
  });
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats)); }
  catch(e){ console.error('Gagal menyimpan data', e); }
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ---------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
function closeAllModals(){
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// ---------------------------------------------------------------
// Home / chat list rendering
// ---------------------------------------------------------------
function initials(name){
  return (name||'?').trim().slice(0,1).toUpperCase();
}

function renderChatList(){
  const list = document.getElementById('chat-list');
  list.innerHTML = '';

  if(state.chats.length === 0){
    list.innerHTML = `<div class="empty-state">Belum ada karakter atau grup.<br>Tekan tombol <b>+</b> di kanan bawah untuk mulai roleplay.</div>`;
    return;
  }

  const sorted = [...state.chats].sort((a,b) => lastActivity(b) - lastActivity(a));

  sorted.forEach(chat => {
    const row = document.createElement('div');
    row.className = 'chat-row';
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg ? previewFor(chat, lastMsg) : 'Belum ada pesan';
    const time = lastMsg ? formatTime(lastMsg.time) : '';

    row.innerHTML = `
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
    `;
    row.addEventListener('click', () => openChat(chat.id));
    list.appendChild(row);
  });
}

function lastActivity(chat){
  if(chat.messages.length === 0) return 0;
  return chat.messages[chat.messages.length-1].time;
}

function previewFor(chat, msg){
  const role = chat.roles.find(r => r.id === msg.roleId);
  const sender = role ? role.name : '?';
  const isMe = role && (role.type === 'me' || role.id === 'me');
  const label = isMe ? '' : `${sender}: `;
  const body = msg.media ? (msg.media.type === 'video' ? '🎥 Video' : '📷 Foto') + (msg.text ? ' · ' + msg.text : '') : msg.text;
  return label + body;
}

function formatTime(ts){
  const d = new Date(ts);
  return d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------
// Creating a new character chat
// ---------------------------------------------------------------
let selectedColor = AVATAR_COLORS[0];

function openCharacterForm(){
  document.getElementById('char-name').value = '';
  selectedColor = AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)];
  const picker = document.getElementById('char-color-picker');
  picker.innerHTML = '';
  AVATAR_COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (c === selectedColor ? ' selected':'');
    dot.style.background = c;
    dot.addEventListener('click', () => {
      selectedColor = c;
      picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
    picker.appendChild(dot);
  });
  openModal('modal-character-form');
}

function saveNewCharacter(){
  const name = document.getElementById('char-name').value.trim();
  if(!name){ alert('Isi nama karakter dulu ya.'); return; }

  const chat = {
    id: uid(),
    type: 'character',
    name: name,
    color: selectedColor,
    avatarUrl: null,
    myBubbleColor: '#0084ff',
    background: { imageUrl: null, opacity: 1 },
    bio: '',
    fontFamily: 'system',
    fontSize: 15,
    roles: [
      { id:'me', name:'Aku', type:'me', color:'#0084ff', avatarUrl:null },
      { id:'char', name:name, type:'other', color:selectedColor, avatarUrl:null }
    ],
    activeRoleId: 'me',
    messages: []
  };
  state.chats.push(chat);
  saveState();
  closeModal('modal-character-form');
  renderChatList();
  openChat(chat.id);
}

// ---------------------------------------------------------------
// Creating a new group chat
// ---------------------------------------------------------------
function openGroupForm(){
  document.getElementById('group-name').value = '';
  const list = document.getElementById('group-members-list');
  list.innerHTML = '';
  addMemberRow();
  addMemberRow();
  openModal('modal-group-form');
}

function addMemberRow(){
  const list = document.getElementById('group-members-list');
  const row = document.createElement('div');
  row.className = 'member-row';
  row.innerHTML = `
    <input type="text" placeholder="Nama anggota">
    <button class="member-remove" type="button">✕</button>
  `;
  row.querySelector('.member-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function saveNewGroup(){
  const name = document.getElementById('group-name').value.trim();
  if(!name){ alert('Isi nama grup dulu ya.'); return; }

  const memberInputs = document.querySelectorAll('#group-members-list input');
  const members = [...memberInputs].map(i => i.value.trim()).filter(Boolean);
  if(members.length === 0){ alert('Tambahkan minimal satu anggota.'); return; }

  const roles = [{ id:'me', name:'Aku', type:'me', color:'#0084ff', avatarUrl:null }];
  members.forEach((m, idx) => {
    roles.push({ id: 'm'+idx+'_'+uid(), name: m, type:'other', color: AVATAR_COLORS[idx % AVATAR_COLORS.length], avatarUrl:null });
  });

  const chat = {
    id: uid(),
    type: 'group',
    name: name,
    color: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)],
    avatarUrl: null,
    myBubbleColor: '#0084ff',
    background: { imageUrl: null, opacity: 1 },
    bio: '',
    fontFamily: 'system',
    fontSize: 15,
    roles: roles,
    activeRoleId: 'me',
    messages: []
  };
  state.chats.push(chat);
  saveState();
  closeModal('modal-group-form');
  renderChatList();
  openChat(chat.id);
}

// ---------------------------------------------------------------
// Chat screen
// ---------------------------------------------------------------
function getCurrentChat(){
  return state.chats.find(c => c.id === state.currentChatId);
}

function openChat(chatId){
  state.currentChatId = chatId;
  const chat = getCurrentChat();
  if(!chat) return;

  renderChatHeaderIdentity();
  renderChatBackground();
  renderBioBanner();
  renderChatFontStyle();
  document.getElementById('chat-header-role').textContent = 'online';
  renderMessages();
  showScreen('screen-chat');

  setTimeout(() => document.getElementById('msg-input').focus(), 200);
}

function renderChatHeaderIdentity(){
  const chat = getCurrentChat();
  const role = chat.roles.find(r => r.id === chat.activeRoleId) || chat.roles[0] || {};
  const avatarEl = document.getElementById('chat-header-avatar');
  avatarEl.style.background = role.color || chat.color;
  avatarEl.innerHTML = role.avatarUrl
    ? `<img src="${role.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : initials(role.name || chat.name);
  document.getElementById('chat-header-name').textContent = role.name || chat.name;
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

// Bio karakter ditampilkan di area yang dulu dipakai untuk indikator peran —
// indikator peran sekarang cukup dicek lewat Pengaturan Chat.
function renderBioBanner(){
  const chat = getCurrentChat();
  const banner = document.getElementById('bio-banner');
  if(chat.bio && chat.bio.trim()){
    banner.textContent = chat.bio.trim();
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
}

// Peran aktif menentukan sudut pandang: pesan dari peran yang SEDANG aktif
// selalu tampil biru di kanan ("aku"), semua pesan dari peran lain tampil
// abu-abu di kiri — dan ini berubah setiap kali kamu ganti peran, termasuk
// untuk pesan-pesan lama yang sudah terkirim sebelumnya.
function switchRole(){
  const chat = getCurrentChat();
  const idx = chat.roles.findIndex(r => r.id === chat.activeRoleId);
  const nextIdx = (idx + 1) % chat.roles.length;
  chat.activeRoleId = chat.roles[nextIdx].id;
  saveState();

  renderChatHeaderIdentity();

  const btn = document.getElementById('btn-switch-role');
  btn.classList.add('spin');
  setTimeout(() => btn.classList.remove('spin'), 300);
}

function buildMessageRow(chat, msg){
  const role = chat.roles.find(r => r.id === msg.roleId) || {name:'?'};
  const isMe = role.type === 'me' || role.id === 'me';

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isMe ? 'me' : 'other');
  row.dataset.roleId = msg.roleId;
  row.dataset.msgId = msg.id;

  const swipeIcon = document.createElement('div');
  swipeIcon.className = 'msg-swipe-icon';
  swipeIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 9V6l-6 6 6 6v-3.1c4.2 0 7.4 1.4 9.6 4.1-.7-4.6-3.4-9-9.6-10z"/></svg>';
  row.appendChild(swipeIcon);

  const content = document.createElement('div');
  content.className = 'msg-content';

  const sender = document.createElement('div');
  sender.className = 'msg-sender';
  sender.textContent = role.name;
  sender.style.display = isMe ? 'none' : 'block';
  content.appendChild(sender);

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (msg.media ? ' has-media' : '');
  if(isMe) bubble.style.background = chat.myBubbleColor || '#0084ff';

  if(msg.replyTo){
    const quote = document.createElement('div');
    quote.className = 'msg-quote';
    const qSenderName = document.createElement('div');
    qSenderName.className = 'msg-quote-sender';
    qSenderName.textContent = msg.replyTo.senderName;
    const qText = document.createElement('div');
    qText.className = 'msg-quote-text';
    qText.textContent = msg.replyTo.text || (msg.replyTo.mediaType === 'video' ? '🎥 Video' : '📷 Foto');
    quote.appendChild(qSenderName);
    quote.appendChild(qText);
    quote.addEventListener('click', () => scrollToMessage(msg.replyTo.id));
    bubble.appendChild(quote);
  }

  if(msg.media){
    if(msg.media.type === 'video'){
      const vid = document.createElement('video');
      vid.src = msg.media.dataUrl;
      vid.controls = true;
      vid.className = 'msg-video';
      vid.addEventListener('click', () => {
        vid.pause();
        openMediaViewer(msg.media);
      });
      bubble.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = msg.media.dataUrl;
      img.className = 'msg-image';
      img.addEventListener('click', (e) => {
        if(e.currentTarget.closest('.msg-content')?.dataset.suppressClick) return;
        openMediaViewer(msg.media);
      });
      bubble.appendChild(img);
    }
    if(msg.text){
      const cap = document.createElement('div');
      cap.className = 'msg-caption';
      cap.textContent = msg.text;
      if(isMe) cap.style.background = chat.myBubbleColor || '#0084ff';
      bubble.appendChild(cap);
    }
  } else if(msg.text){
    const textEl = document.createElement('span');
    textEl.textContent = msg.text;
    bubble.appendChild(textEl);
  }
  content.appendChild(bubble);

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(msg.time) + (msg.edited ? ' · diedit' : '');
  content.appendChild(time);

  row.appendChild(content);
  attachGestures(content, swipeIcon, chat, msg, role);

  return row;
}

// ---------------------------------------------------------------
// Gestur pesan: geser untuk membalas, tekan-tahan untuk edit/hapus
// ---------------------------------------------------------------
function attachGestures(content, swipeIcon, chat, msg, role){
  const THRESHOLD = 50;
  const MAX_DRAG = 68;
  const LONG_PRESS_MS = 480;
  let startX = 0, startY = 0, dragging = false, locked = null;
  let longPressTimer = null, longPressFired = false;

  const clearLongPress = () => {
    if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; }
  };

  content.addEventListener('pointerdown', (e) => {
    if(e.target.closest('video')) return; // jangan ganggu kontrol video
    delete content.dataset.suppressClick;
    startX = e.clientX; startY = e.clientY;
    dragging = true; locked = null; longPressFired = false;

    longPressTimer = setTimeout(() => {
      longPressFired = true;
      content.dataset.suppressClick = '1';
      dragging = false;
      content.classList.remove('dragging');
      content.classList.add('snap-back');
      content.style.transform = 'translateX(0)';
      swipeIcon.classList.remove('visible');
      setTimeout(() => content.classList.remove('snap-back'), 250);
      openMessageActions(msg);
    }, LONG_PRESS_MS);

    content.classList.add('dragging');
  });

  content.addEventListener('pointermove', (e) => {
    if(!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if(locked === null){
      if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      clearLongPress(); // sudah jelas ini geser, bukan tekan-tahan
    }
    if(locked === 'y'){ dragging = false; content.classList.remove('dragging'); return; }

    const clamped = Math.max(0, Math.min(dx, MAX_DRAG));
    content.style.transform = `translateX(${clamped}px)`;
    swipeIcon.classList.toggle('visible', clamped > 20);
  });

  const endDrag = (e) => {
    clearLongPress();
    if(!dragging) return;
    dragging = false;
    content.classList.remove('dragging');
    content.classList.add('snap-back');

    const dx = e.clientX ? e.clientX - startX : 0;
    if(locked === 'x' && Math.abs(dx) > 6) content.dataset.suppressClick = '1';
    if(!longPressFired && locked === 'x' && dx > THRESHOLD){
      startReply(chat, msg, role);
    }
    content.style.transform = 'translateX(0)';
    swipeIcon.classList.remove('visible');
    setTimeout(() => content.classList.remove('snap-back'), 250);
  };
  content.addEventListener('pointerup', endDrag);
  content.addEventListener('pointercancel', endDrag);
  content.addEventListener('pointerleave', endDrag);
}

// ---------------------------------------------------------------
// Tekan-tahan pesan: Edit / Hapus
// ---------------------------------------------------------------
let activeActionMsg = null;

function openMessageActions(msg){
  activeActionMsg = msg;
  openModal('modal-msg-actions');
}

function scrollToMessage(msgId){
  const box = document.getElementById('messages');
  const target = box.querySelector(`[data-msg-id="${msgId}"]`);
  if(!target) return;
  target.scrollIntoView({ behavior:'smooth', block:'center' });
  target.classList.add('msg-flash');
  setTimeout(() => target.classList.remove('msg-flash'), 1000);
}

function renderMessages(){
  const chat = getCurrentChat();
  const box = document.getElementById('messages');
  box.innerHTML = '';

  if(chat.messages.length === 0){
    box.innerHTML = `<div class="empty-chat">Belum ada percakapan.<br>Ketik pesan pertama untuk mulai roleplay dengan ${escapeHtml(chat.name)}.</div>`;
    return;
  }

  chat.messages.forEach(msg => box.appendChild(buildMessageRow(chat, msg)));
  box.scrollTop = box.scrollHeight;
}

// ---------------------------------------------------------------
// Balas pesan (reply)
// ---------------------------------------------------------------
let replyingTo = null; // {id, senderName, text, mediaType} | null

function startReply(chat, msg, role){
  replyingTo = {
    id: msg.id,
    senderName: role.name,
    text: msg.text || null,
    mediaType: msg.media ? msg.media.type : null
  };
  document.getElementById('reply-preview-sender').textContent = role.name;
  document.getElementById('reply-preview-text').textContent =
    msg.text || (msg.media && msg.media.type === 'video' ? '🎥 Video' : msg.media ? '📷 Foto' : '');
  document.getElementById('reply-preview-bar').classList.add('active');
  document.getElementById('msg-input').focus();
}

function clearReply(){
  replyingTo = null;
  document.getElementById('reply-preview-bar').classList.remove('active');
}

function sendMessage(){
  const input = document.getElementById('msg-input');
  const text = input.value.trim();

  if(!text && !pendingMedia) return;

  const chat = getCurrentChat();
  const msg = {
    id: uid(),
    roleId: chat.activeRoleId,
    text: text || undefined,
    media: pendingMedia || undefined,
    replyTo: replyingTo || undefined,
    time: Date.now()
  };
  chat.messages.push(msg);
  saveState();

  const box = document.getElementById('messages');
  if(chat.messages.length === 1){ renderMessages(); }
  else{
    const row = buildMessageRow(chat, msg);
    row.classList.add('msg-enter');
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  input.value = '';
  clearPendingMedia();
  clearReply();
}

// ---------------------------------------------------------------
// Lihat foto / video secara fullscreen
// ---------------------------------------------------------------
function openMediaViewer(media){
  const viewer = document.getElementById('media-viewer');
  const stage = document.getElementById('media-viewer-stage');
  stage.innerHTML = '';
  if(media.type === 'video'){
    const vid = document.createElement('video');
    vid.src = media.dataUrl;
    vid.controls = true;
    vid.muted = true;
    vid.autoplay = true;
    vid.playsInline = true;
    stage.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.src = media.dataUrl;
    stage.appendChild(img);
  }
  viewer.classList.add('active');
}

function closeMediaViewer(){
  const viewer = document.getElementById('media-viewer');
  document.getElementById('media-viewer-stage').innerHTML = '';
  viewer.classList.remove('active');
}

// ---------------------------------------------------------------
// Kirim foto / video
// ---------------------------------------------------------------
let pendingMedia = null; // {type:'image'|'video', dataUrl}

function clearPendingMedia(){
  pendingMedia = null;
  document.getElementById('media-preview-bar').classList.remove('active');
  document.getElementById('media-preview-thumb').innerHTML = '';
  document.getElementById('media-preview-name').textContent = '';
  document.getElementById('media-input').value = '';
}

// Resize + kompres gambar via canvas, return Promise<dataURL>
function resizeImageFile(file, maxW, quality){
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function handleMediaFile(file){
  if(!file) return;
  const isVideo = file.type.startsWith('video/');

  if(isVideo && file.size > 15 * 1024 * 1024){
    alert('Video ini agak besar (>15MB), mungkin gagal tersimpan di HP. Coba video yang lebih pendek/kecil.');
  }

  const finish = (dataUrl) => {
    pendingMedia = { type: isVideo ? 'video' : 'image', dataUrl };
    const thumb = document.getElementById('media-preview-thumb');
    thumb.innerHTML = '';
    if(isVideo){
      const v = document.createElement('video');
      v.src = dataUrl; v.muted = true;
      thumb.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = dataUrl;
      thumb.appendChild(img);
    }
    document.getElementById('media-preview-name').textContent = isVideo ? 'Video siap dikirim' : 'Foto siap dikirim';
    document.getElementById('media-preview-bar').classList.add('active');
  };

  if(isVideo){
    const reader = new FileReader();
    reader.onload = () => finish(reader.result);
    reader.readAsDataURL(file);
  } else {
    resizeImageFile(file, 1280, 0.82).then(finish);
  }
}

// ---------------------------------------------------------------
// Pengaturan chat: nama, foto profil, warna bubble, latar belakang
// ---------------------------------------------------------------
const BUBBLE_COLOR_PRESETS = ['#0084ff','#3ecf8e','#f2426e','#a06bd7','#f2a94e','#00b8d9','#7c8b9a','#111111'];
let pendingAvatarDataUrl = undefined;   // undefined = tak berubah, null = dihapus, string = baru
let pendingMeAvatarDataUrl = undefined;
let pendingBgDataUrl = undefined;

function openChatSettings(){
  const chat = getCurrentChat();
  pendingAvatarDataUrl = undefined;
  pendingMeAvatarDataUrl = undefined;
  pendingBgDataUrl = undefined;

  const meRole = chat.roles.find(r => r.type === 'me' || r.id === 'me');
  document.getElementById('settings-myname').value = meRole ? meRole.name : 'Aku';
  document.getElementById('settings-name').value = chat.name;
  document.getElementById('settings-bio').value = chat.bio || '';

  const activeRole = chat.roles.find(r => r.id === chat.activeRoleId);
  document.getElementById('settings-active-role-line').textContent =
    'Peran aktif saat ini di chat ini: ' + (activeRole ? activeRole.name : '-');

  const mePreview = document.getElementById('settings-me-avatar-preview');
  mePreview.style.background = meRole ? (meRole.color || '#0084ff') : '#0084ff';
  mePreview.innerHTML = meRole && meRole.avatarUrl
    ? `<img src="${meRole.avatarUrl}">`
    : (meRole ? initials(meRole.name) : 'A');

  const preview = document.getElementById('settings-avatar-preview');
  preview.style.background = chat.color;
  preview.innerHTML = chat.avatarUrl
    ? `<img src="${chat.avatarUrl}">`
    : initials(chat.name);

  const picker = document.getElementById('settings-color-picker');
  const customInput = document.getElementById('settings-color-custom');
  customInput.value = chat.myBubbleColor || '#0084ff';
  picker.innerHTML = '';
  BUBBLE_COLOR_PRESETS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (c.toLowerCase() === (chat.myBubbleColor||'').toLowerCase() ? ' selected' : '');
    dot.style.background = c;
    dot.addEventListener('click', () => {
      customInput.value = c;
      picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
    picker.appendChild(dot);
  });
  customInput.oninput = () => picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));

  const opacityPct = Math.round((chat.background?.opacity ?? 1) * 100);
  document.getElementById('settings-bg-opacity').value = opacityPct;

  document.getElementById('settings-font-family').value = chat.fontFamily || 'system';
  document.getElementById('settings-font-size').value = chat.fontSize || 15;

  openModal('modal-chat-settings');
}

function saveChatSettings(){
  const chat = getCurrentChat();
  const newName = document.getElementById('settings-name').value.trim();
  if(newName) chat.name = newName;

  // sinkronkan nama karakter ke role lawan (1v1) supaya label bubble ikut berubah
  if(newName && chat.type === 'character'){
    const charRole = chat.roles.find(r => r.id !== 'me' && r.type === 'other');
    if(charRole) charRole.name = newName;
  }

  const myName = document.getElementById('settings-myname').value.trim();
  const meRole = chat.roles.find(r => r.type === 'me' || r.id === 'me');
  if(myName && meRole) meRole.name = myName;
  if(meRole && pendingMeAvatarDataUrl !== undefined) meRole.avatarUrl = pendingMeAvatarDataUrl;

  chat.bio = document.getElementById('settings-bio').value.trim();

  if(pendingAvatarDataUrl !== undefined) chat.avatarUrl = pendingAvatarDataUrl;

  const charRole = chat.roles.find(r => r.id !== 'me' && r.type === 'other');
  if(chat.type === 'character' && charRole && pendingAvatarDataUrl !== undefined){
    charRole.avatarUrl = pendingAvatarDataUrl;
  }

  chat.myBubbleColor = document.getElementById('settings-color-custom').value;

  if(!chat.background) chat.background = { imageUrl:null, opacity:1 };
  if(pendingBgDataUrl !== undefined) chat.background.imageUrl = pendingBgDataUrl;
  chat.background.opacity = Number(document.getElementById('settings-bg-opacity').value) / 100;

  chat.fontFamily = document.getElementById('settings-font-family').value;
  chat.fontSize = Number(document.getElementById('settings-font-size').value);

  saveState();
  closeModal('modal-chat-settings');

  renderChatHeaderIdentity();
  renderChatBackground();
  renderBioBanner();
  renderChatFontStyle();
  renderMessages();
  renderChatList();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-chat-settings').addEventListener('click', openChatSettings);
  document.getElementById('settings-cancel').addEventListener('click', () => closeModal('modal-chat-settings'));
  document.getElementById('settings-save').addEventListener('click', saveChatSettings);
  document.getElementById('reply-preview-remove').addEventListener('click', clearReply);

  document.getElementById('btn-upload-me-avatar').addEventListener('click', () => {
    document.getElementById('me-avatar-input').click();
  });
  document.getElementById('me-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    resizeImageFile(file, 500, 0.85).then(dataUrl => {
      pendingMeAvatarDataUrl = dataUrl;
      document.getElementById('settings-me-avatar-preview').innerHTML = `<img src="${dataUrl}">`;
    });
  });

  document.getElementById('btn-upload-avatar').addEventListener('click', () => {
    document.getElementById('avatar-input').click();
  });
  document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    resizeImageFile(file, 500, 0.85).then(dataUrl => {
      pendingAvatarDataUrl = dataUrl;
      const preview = document.getElementById('settings-avatar-preview');
      preview.innerHTML = `<img src="${dataUrl}">`;
    });
  });

  document.getElementById('btn-upload-bg').addEventListener('click', () => {
    document.getElementById('bg-input').click();
  });
  document.getElementById('bg-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    resizeImageFile(file, 1080, 0.8).then(dataUrl => { pendingBgDataUrl = dataUrl; });
  });
  document.getElementById('btn-remove-bg').addEventListener('click', () => {
    pendingBgDataUrl = null;
  });
});
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderChatList();

  const applyTheme = () => document.body.classList.toggle('dark', localStorage.getItem('rp_theme') === 'dark');
  applyTheme();
  document.getElementById('btn-theme').addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('rp_theme', dark ? 'dark' : 'light');
  });

  document.getElementById('btn-fab').addEventListener('click', () => openModal('modal-new'));
  document.getElementById('opt-cancel-new').addEventListener('click', () => closeModal('modal-new'));

  document.getElementById('opt-new-character').addEventListener('click', () => {
    closeModal('modal-new');
    openCharacterForm();
  });
  document.getElementById('opt-new-group').addEventListener('click', () => {
    closeModal('modal-new');
    openGroupForm();
  });

  document.getElementById('char-cancel').addEventListener('click', () => closeModal('modal-character-form'));
  document.getElementById('char-save').addEventListener('click', saveNewCharacter);

  document.getElementById('group-cancel').addEventListener('click', () => closeModal('modal-group-form'));
  document.getElementById('group-save').addEventListener('click', saveNewGroup);
  document.getElementById('btn-add-member').addEventListener('click', addMemberRow);

  document.getElementById('btn-back').addEventListener('click', () => {
    showScreen('screen-home');
    renderChatList();
  });
  document.getElementById('btn-switch-role').addEventListener('click', switchRole);
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); sendMessage(); }
  });

  document.getElementById('btn-attach').addEventListener('click', () => {
    document.getElementById('media-input').click();
  });
  document.getElementById('media-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) handleMediaFile(file);
  });
  document.getElementById('media-preview-remove').addEventListener('click', clearPendingMedia);

  document.getElementById('media-viewer-close').addEventListener('click', closeMediaViewer);
  document.getElementById('media-viewer').addEventListener('click', (e) => {
    if(e.target.id === 'media-viewer') closeMediaViewer();
  });

  document.getElementById('opt-cancel-msg-actions').addEventListener('click', () => closeModal('modal-msg-actions'));

  document.getElementById('opt-edit-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg) return;
    document.getElementById('edit-message-text').value = activeActionMsg.text || '';
    openModal('modal-edit-message');
  });

  document.getElementById('opt-delete-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg) return;
    if(!confirm('Hapus pesan ini?')) return;
    const chat = getCurrentChat();
    chat.messages = chat.messages.filter(m => m.id !== activeActionMsg.id);
    saveState();
    renderMessages();
    renderChatList();
  });

  document.getElementById('edit-message-cancel').addEventListener('click', () => closeModal('modal-edit-message'));
  document.getElementById('edit-message-save').addEventListener('click', () => {
    if(!activeActionMsg) return;
    const chat = getCurrentChat();
    const target = chat.messages.find(m => m.id === activeActionMsg.id);
    if(target){
      const newText = document.getElementById('edit-message-text').value.trim();
      if(!newText && !target.media){
        alert('Pesan tidak boleh kosong.');
        return;
      }
      target.text = newText || undefined;
      target.edited = true;
      saveState();
      renderMessages();
      renderChatList();
    }
    closeModal('modal-edit-message');
  });

  // klik area gelap pada modal untuk menutup
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) overlay.classList.remove('active');
    });
  });

  // tombol back fisik Android (Capacitor akan memicu 'backbutton' via App plugin,
  // tapi fallback popstate juga disiapkan untuk browser biasa)
  window.addEventListener('popstate', () => {
    if(document.getElementById('media-viewer').classList.contains('active')){
      closeMediaViewer();
      return;
    }
    if(document.getElementById('screen-chat').classList.contains('active')){
      showScreen('screen-home');
      renderChatList();
    }
  });
});
