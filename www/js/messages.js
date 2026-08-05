// ===================================================================
// messages.js — render pesan, gestur, balas, reaksi, narasi, kirim
// ===================================================================

const RENDER_BATCH = 40; // jumlah pesan yang dirender sekaligus (render bertahap)
let renderedFrom = 0;    // index pesan paling awal yang sudah dirender di layar

function buildNarrationRow(msg){
  const row = document.createElement('div');
  row.className = 'msg-row narration';
  row.dataset.msgId = msg.id;
  const text = document.createElement('div');
  text.className = 'narration-text';
  text.textContent = msg.text || '';
  row.appendChild(text);
  if(msg.reaction){
    const reactionEl = document.createElement('div');
    reactionEl.textContent = msg.reaction;
    reactionEl.style.fontSize = '13px';
    reactionEl.style.marginTop = '2px';
    row.appendChild(reactionEl);
  }
  attachLongPressOnly(row, msg);
  return row;
}

function buildMessageRow(chat, msg){
  if(msg.isNarration) return buildNarrationRow(msg);

  const role = chat.roles.find(r => r.id === msg.roleId) || {name:'?'};
  const isActive = msg.roleId === chat.activeRoleId;

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isActive ? 'me' : 'other');
  row.dataset.roleId = msg.roleId;
  row.dataset.msgId = msg.id;

  const swipeIcon = document.createElement('div');
  swipeIcon.className = 'msg-swipe-icon';
  swipeIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 9V6l-6 6 6 6v-3.1c4.2 0 7.4 1.4 9.6 4.1-.7-4.6-3.4-9-9.6-10z"/></svg>';
  row.appendChild(swipeIcon);

  const body = document.createElement('div');
  body.className = 'msg-body';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.style.background = role.color || chat.color || '#6b7fd7';
  avatar.innerHTML = role.avatarUrl ? `<img src="${role.avatarUrl}">` : '';
  if(!role.avatarUrl) avatar.textContent = initials(role.name || '?');
  body.appendChild(avatar);

  const content = document.createElement('div');
  content.className = 'msg-content';

  const sender = document.createElement('div');
  sender.className = 'msg-sender';
  sender.textContent = role.name;
  sender.style.display = isActive ? 'none' : 'block';
  content.appendChild(sender);

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (msg.media && msg.media.type !== 'audio' ? ' has-media' : '');
  if(isActive) bubble.style.background = bubbleBackgroundCss(chat.bubbleStyle);

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

  if(msg.media && msg.media.type === 'audio'){
    bubble.appendChild(createVoiceNote(msg));
    if(msg.text){
      const cap = document.createElement('div');
      cap.className = 'msg-caption';
      cap.textContent = msg.text;
      if(msg.text && isActive) cap.style.background = bubbleBackgroundCss(chat.bubbleStyle);
      bubble.appendChild(cap);
    }
  } else if(msg.media){
    if(msg.media.type === 'video'){
      const vid = document.createElement('video');
      setMediaSrc(vid, msg.media);
      vid.controls = true;
      vid.className = 'msg-video';
      vid.addEventListener('click', () => { vid.pause(); openMediaViewer(msg.media); });
      bubble.appendChild(vid);
    } else {
      const img = document.createElement('img');
      setMediaSrc(img, msg.media);
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
      if(isActive) cap.style.background = bubbleBackgroundCss(chat.bubbleStyle);
      bubble.appendChild(cap);
    }
  } else if(msg.text){
    const textEl = document.createElement('span');
    textEl.textContent = msg.text;
    bubble.appendChild(textEl);
  }
  if(msg.reaction){
    const reactionEl = document.createElement('div');
    reactionEl.className = 'msg-reaction';
    reactionEl.textContent = msg.reaction;
    bubble.appendChild(reactionEl); // ditaruh relatif ke bubble, bukan ke seluruh konten pesan
  }
  content.appendChild(bubble);

  const time = document.createElement('div');
  time.className = 'msg-time' + (msg.reaction ? ' has-reaction' : '');
  time.textContent = formatTime(msg.time) + (msg.edited ? ' · diedit' : '');
  content.appendChild(time);

  body.appendChild(content);
  row.appendChild(body);
  attachGestures(content, swipeIcon, chat, msg, role);

  return row;
}

// ---------------------------------------------------------------
// Gestur pesan: geser untuk membalas, tekan-tahan untuk aksi
// ---------------------------------------------------------------
function attachLongPressOnly(row, msg){
  let timer = null;
  row.addEventListener('pointerdown', () => { timer = setTimeout(() => openMessageActions(msg), 480); });
  const cancel = () => { if(timer){ clearTimeout(timer); timer = null; } };
  row.addEventListener('pointerup', cancel);
  row.addEventListener('pointerleave', cancel);
  row.addEventListener('pointercancel', cancel);
}

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
    if(e.target.closest('video')) return;
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
      clearLongPress();
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
// Menu aksi pesan: Balas / Reaksi / Salin / Edit / Hapus
// ---------------------------------------------------------------
let activeActionMsg = null;

function openMessageActions(msg){
  activeActionMsg = msg;
  openModal('modal-msg-actions');
}

function scrollToMessage(msgId){
  const chat = getCurrentChat();
  const idx = chat.messages.findIndex(m => m.id === msgId);
  // pastikan pesan yang dituju sudah ter-render (render bertahap)
  if(idx >= 0 && idx < renderedFrom){
    renderedFrom = Math.max(0, idx - 5);
    renderMessages(false);
  }
  const box = document.getElementById('messages');
  const target = box.querySelector(`[data-msg-id="${msgId}"]`);
  if(!target) return;
  target.scrollIntoView({ behavior:'smooth', block:'center' });
  target.classList.add('msg-flash');
  setTimeout(() => target.classList.remove('msg-flash'), 1000);
}

function openReactionPicker(){
  closeModal('modal-msg-actions');
  const bar = document.getElementById('reaction-picker-bar');
  bar.innerHTML = '';
  REACTION_EMOJIS.forEach(emo => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reaction-option';
    btn.textContent = emo;
    btn.addEventListener('click', () => {
      if(!activeActionMsg) return;
      const chat = getCurrentChat();
      const target = chat.messages.find(m => m.id === activeActionMsg.id);
      if(target){
        target.reaction = target.reaction === emo ? null : emo; // tap lagi emoji sama = hapus reaksi
        saveState();
        renderMessages(false);
      }
      closeModal('modal-reaction-picker');
    });
    bar.appendChild(btn);
  });
  openModal('modal-reaction-picker');
}

// ---------------------------------------------------------------
// Render pesan (dengan render bertahap / lazy untuk chat panjang)
// ---------------------------------------------------------------
function renderMessages(resetScroll = true){
  const chat = getCurrentChat();
  const box = document.getElementById('messages');
  box.innerHTML = '';

  if(chat.messages.length === 0){
    box.innerHTML = `<div class="empty-chat">Belum ada percakapan.<br>Ketik pesan pertama untuk mulai roleplay dengan ${escapeHtml(chat.name)}.</div>`;
    return;
  }

  renderedFrom = Math.max(0, chat.messages.length - RENDER_BATCH);
  if(renderedFrom > 0){
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'load-more-btn';
    loadMore.textContent = 'Muat pesan lebih lama ⬆️';
    loadMore.addEventListener('click', loadOlderMessages);
    box.appendChild(loadMore);
  }
  chat.messages.slice(renderedFrom).forEach(msg => box.appendChild(buildMessageRow(chat, msg)));
  if(resetScroll) box.scrollTop = box.scrollHeight;
}

function loadOlderMessages(){
  const chat = getCurrentChat();
  const box = document.getElementById('messages');
  const prevHeight = box.scrollHeight;
  const newFrom = Math.max(0, renderedFrom - RENDER_BATCH);
  const older = chat.messages.slice(newFrom, renderedFrom);
  renderedFrom = newFrom;

  box.removeChild(box.firstChild); // buang tombol "muat lebih lama" lama
  const frag = document.createDocumentFragment();
  if(renderedFrom > 0){
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'load-more-btn';
    loadMore.textContent = 'Muat pesan lebih lama ⬆️';
    loadMore.addEventListener('click', loadOlderMessages);
    frag.appendChild(loadMore);
  }
  older.forEach(msg => frag.appendChild(buildMessageRow(chat, msg)));
  box.prepend(frag);
  box.scrollTop = box.scrollHeight - prevHeight; // pertahankan posisi scroll
}

// Dipanggil setelah ganti peran: menukar class 'me'/'other' dan label pengirim
// pada baris yang sudah ada di layar, tanpa membangun ulang DOM.
function updateMessagePerspective(){
  const chat = getCurrentChat();
  const box = document.getElementById('messages');
  [...box.children].forEach(row => {
    const roleId = row.dataset.roleId;
    if(!roleId) return;
    const isActive = roleId === chat.activeRoleId;
    row.classList.toggle('me', isActive);
    row.classList.toggle('other', !isActive);
    const label = row.querySelector('.msg-sender');
    if(label) label.style.display = isActive ? 'none' : 'block';
    const bubble = row.querySelector('.bubble');
    if(bubble) bubble.style.background = isActive ? bubbleBackgroundCss(chat.bubbleStyle) : '';
    const caption = row.querySelector('.msg-caption');
    if(caption) caption.style.background = isActive ? bubbleBackgroundCss(chat.bubbleStyle) : '';
  });
}

// ---------------------------------------------------------------
// Balas pesan (reply)
// ---------------------------------------------------------------
let replyingTo = null;

function startReply(chat, msg, role){
  replyingTo = {
    id: msg.id,
    senderName: msg.isNarration ? 'Narasi' : role.name,
    text: msg.text || null,
    mediaType: msg.media ? msg.media.type : null
  };
  document.getElementById('reply-preview-sender').textContent = replyingTo.senderName;
  document.getElementById('reply-preview-text').textContent =
    msg.text || (msg.media && msg.media.type === 'video' ? '🎥 Video' : msg.media ? '📷 Foto' : '');
  document.getElementById('reply-preview-bar').classList.add('active');
  document.getElementById('msg-input').focus();
}

function clearReply(){
  replyingTo = null;
  document.getElementById('reply-preview-bar').classList.remove('active');
}

// ---------------------------------------------------------------
// Mode narasi: pesan tampil di tengah tanpa nama pengirim/bubble arah
// ---------------------------------------------------------------
let narrationMode = false;

function toggleNarrationMode(){
  narrationMode = !narrationMode;
  document.getElementById('btn-narration').classList.toggle('active', narrationMode);
  document.getElementById('msg-input').placeholder = narrationMode ? 'Tulis narasi...' : 'Pesan';
}

function sendMessage(){
  const input = document.getElementById('msg-input');
  const text = input.value.trim();

  if(!text && !pendingMedia) return;

  const chat = getCurrentChat();
  const msg = {
    id: uid(),
    roleId: narrationMode ? null : chat.activeRoleId,
    isNarration: narrationMode,
    text: text || undefined,
    media: narrationMode ? undefined : (pendingMedia || undefined),
    replyTo: replyingTo || undefined,
    reaction: null,
    time: Date.now()
  };
  chat.messages.push(msg);
  chat.draft = '';
  persistMedia(msg).then(() => saveState()); // native: dataUrl -> file asli dulu

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

// Autosave draft ketik (debounced) supaya tidak hilang saat pindah chat
const autosaveDraft = debounce(() => {
  const chat = getCurrentChat();
  if(!chat) return;
  chat.draft = document.getElementById('msg-input').value;
  saveState();
}, 400);
