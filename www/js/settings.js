// ===================================================================
// settings.js — modal Pengaturan Chat (dirombak jadi bertab) + Pengaturan Aplikasi
// ===================================================================

let settingsChat = null;
let avatarUploadTarget = null; // role object, atau string 'chat' (avatar grup)

function openChatSettings(){
  settingsChat = getCurrentChat();
  setSettingsTab('profil');
  renderSettingsProfilTab();
  renderSettingsMembersTab();
  renderSettingsTampilanTab();
  openModal('modal-chat-settings');
}

function setSettingsTab(tab){
  document.querySelectorAll('#modal-chat-settings .settings-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('#modal-chat-settings .settings-tab-panel').forEach(p => {
    p.style.display = (p.dataset.tab === tab) ? '' : 'none';
  });
}

function initSettingsTabs(){
  document.querySelectorAll('#modal-chat-settings .settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.tab));
  });
}

// ---------------------------------------------------------------
// Tab "Profil" — daftar persona milikmu ("Aku")
// ---------------------------------------------------------------
function renderSettingsProfilTab(){
  const list = document.getElementById('settings-personas-list');
  list.innerHTML = '';
  const personas = myRoles(settingsChat);
  personas.forEach(role => {
    list.appendChild(buildRoleCard(role, {
      allowDelete: personas.length > 1,
      onDelete: () => deleteRole(role, personas)
    }));
  });
}

function addPersona(){
  const role = { id: 'p_' + uid(), name: 'Persona Baru', type: 'me', color: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)], avatarUrl: null, bio: '' };
  settingsChat.roles.push(role);
  saveState();
  renderSettingsProfilTab();
}

// ---------------------------------------------------------------
// Tab "Anggota"/"Karakter" — role bertipe 'other'
// ---------------------------------------------------------------
function renderSettingsMembersTab(){
  const label = document.getElementById('settings-members-title');
  const list = document.getElementById('settings-members-list');
  const addBtn = document.getElementById('btn-add-member-settings');
  list.innerHTML = '';

  const members = otherRoles(settingsChat);
  label.textContent = settingsChat.type === 'group' ? 'Anggota Grup' : 'Karakter';
  addBtn.style.display = settingsChat.type === 'group' ? '' : 'none';

  members.forEach(role => {
    list.appendChild(buildRoleCard(role, {
      allowDelete: settingsChat.type === 'group' && members.length > 1,
      onDelete: () => deleteRole(role, members)
    }));
  });
}

function addMember(){
  const name = prompt('Nama anggota baru:');
  if(!name || !name.trim()) return;
  const role = { id: 'm_' + uid(), name: name.trim(), type: 'other', color: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)], avatarUrl: null, bio: '' };
  settingsChat.roles.push(role);
  saveState();
  renderSettingsMembersTab();
}

function deleteRole(role, siblings){
  if(siblings.length <= 1) return;
  if(!confirm(`Hapus "${role.name}"? Pesan-pesan lama dari peran ini akan tetap ada, tapi perannya tidak bisa dipilih lagi.`)) return;
  settingsChat.roles = settingsChat.roles.filter(r => r.id !== role.id);
  if(settingsChat.activeRoleId === role.id){
    settingsChat.activeRoleId = settingsChat.roles[0].id;
  }
  saveState();
  renderSettingsProfilTab();
  renderSettingsMembersTab();
  renderChatHeaderIdentity();
}

// Kartu peran dipakai bersama oleh tab Profil (persona) & tab Anggota/Karakter
function buildRoleCard(role, opts){
  const card = document.createElement('div');
  card.className = 'role-card';
  card.innerHTML = `
    <div class="role-card-top">
      <div class="role-card-avatar" style="background:${role.color}">
        ${role.avatarUrl ? `<img src="${role.avatarUrl}">` : initials(role.name)}
      </div>
      <div class="role-card-fields">
        <input type="text" class="role-name-input" value="${escapeHtml(role.name)}" placeholder="Nama">
        <div class="role-color-dots"></div>
      </div>
      ${opts.allowDelete ? '<button type="button" class="role-delete-btn">✕</button>' : ''}
    </div>
    <textarea class="role-bio-input" placeholder="Bio / deskripsi singkat...">${escapeHtml(role.bio || '')}</textarea>
    <button type="button" class="btn-secondary role-avatar-btn">Ubah foto</button>
  `;

  const dotsWrap = card.querySelector('.role-color-dots');
  AVATAR_COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot small' + (c === role.color ? ' selected' : '');
    dot.style.background = c;
    dot.addEventListener('click', () => {
      role.color = c;
      saveState();
      dotsWrap.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      card.querySelector('.role-card-avatar').style.background = c;
      if(role.id === settingsChat.activeRoleId || otherRoles(settingsChat)[0] === role) renderChatHeaderIdentity();
    });
    dotsWrap.appendChild(dot);
  });

  card.querySelector('.role-name-input').addEventListener('input', debounce((e) => {
    role.name = e.target.value.trim() || role.name;
    if(settingsChat.type === 'character' && role.type === 'other') settingsChat.name = role.name;
    saveState();
    renderChatHeaderIdentity();
    renderChatList();
  }, 300));

  card.querySelector('.role-bio-input').addEventListener('input', debounce((e) => {
    role.bio = e.target.value;
    saveState();
    renderBioBanner();
  }, 300));

  card.querySelector('.role-avatar-btn').addEventListener('click', () => {
    avatarUploadTarget = role;
    document.getElementById('settings-role-avatar-input').click();
  });

  if(opts.allowDelete){
    card.querySelector('.role-delete-btn').addEventListener('click', opts.onDelete);
  }
  return card;
}

// ---------------------------------------------------------------
// Tab "Tampilan" — nama grup, latar, font, warna bubble, warna aksi
// ---------------------------------------------------------------
function renderSettingsTampilanTab(){
  const groupNameRow = document.getElementById('settings-group-name-row');
  const groupAvatarRow = document.getElementById('settings-group-avatar-row');
  const isGroup = settingsChat.type === 'group';
  groupNameRow.style.display = isGroup ? '' : 'none';
  groupAvatarRow.style.display = isGroup ? '' : 'none';

  if(isGroup){
    document.getElementById('settings-group-name').value = settingsChat.name;
    const prev = document.getElementById('settings-group-avatar-preview');
    prev.style.background = settingsChat.color;
    prev.innerHTML = settingsChat.avatarUrl
      ? `<img src="${settingsChat.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
      : initials(settingsChat.name);
  }

  // latar belakang
  const bgPrev = document.getElementById('settings-bg-preview');
  bgPrev.style.backgroundImage = settingsChat.background.imageUrl ? `url(${settingsChat.background.imageUrl})` : 'none';
  document.getElementById('settings-bg-opacity').value = Math.round((settingsChat.background.opacity ?? 1) * 100);
  document.getElementById('btn-remove-bg').style.display = settingsChat.background.imageUrl ? '' : 'none';

  // font
  document.getElementById('settings-font-family').value = settingsChat.fontFamily;
  document.getElementById('settings-font-size').value = settingsChat.fontSize;

  // bubble style (solid / gradient campuran)
  document.getElementById('settings-bubble-mode').value = settingsChat.bubbleStyle.mode;
  document.getElementById('settings-bubble-c1').value = settingsChat.bubbleStyle.c1;
  document.getElementById('settings-bubble-c2').value = settingsChat.bubbleStyle.c2;
  document.getElementById('settings-bubble-c2-row').style.display = settingsChat.bubbleStyle.mode === 'gradient' ? '' : 'none';
  document.getElementById('settings-bubble-preview').style.background = bubbleBackgroundCss(settingsChat.bubbleStyle);

  // warna aksi
  document.getElementById('settings-action-color').value = settingsChat.actionColor;
}

function initSettingsTampilanEvents(){
  document.getElementById('settings-group-name').addEventListener('input', debounce((e) => {
    settingsChat.name = e.target.value.trim() || settingsChat.name;
    saveState();
    renderChatHeaderIdentity();
    renderChatList();
  }, 300));

  document.getElementById('settings-group-avatar-row').querySelector('.btn-secondary').addEventListener('click', () => {
    avatarUploadTarget = 'chat';
    document.getElementById('settings-role-avatar-input').click();
  });

  document.getElementById('settings-role-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file || !avatarUploadTarget) return;
    resizeImageFile(file, 400, 0.85).then(dataUrl => {
      if(avatarUploadTarget === 'chat') settingsChat.avatarUrl = dataUrl;
      else avatarUploadTarget.avatarUrl = dataUrl;
      saveState();
      renderChatHeaderIdentity();
      renderChatList();
      renderSettingsProfilTab();
      renderSettingsMembersTab();
      renderSettingsTampilanTab();
      e.target.value = '';
    });
  });

  document.getElementById('btn-upload-bg').addEventListener('click', () => document.getElementById('settings-bg-input').click());
  document.getElementById('settings-bg-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    resizeImageFile(file, 1000, 0.75).then(dataUrl => {
      settingsChat.background.imageUrl = dataUrl;
      saveState();
      renderChatBackground();
      renderSettingsTampilanTab();
      e.target.value = '';
    });
  });
  document.getElementById('btn-remove-bg').addEventListener('click', () => {
    settingsChat.background.imageUrl = null;
    saveState();
    renderChatBackground();
    renderSettingsTampilanTab();
  });
  document.getElementById('settings-bg-opacity').addEventListener('input', (e) => {
    settingsChat.background.opacity = Number(e.target.value) / 100;
    saveState();
    renderChatBackground();
  });

  document.getElementById('settings-font-family').addEventListener('change', (e) => {
    settingsChat.fontFamily = e.target.value;
    saveState();
    renderChatFontStyle();
  });
  document.getElementById('settings-font-size').addEventListener('input', (e) => {
    settingsChat.fontSize = Number(e.target.value);
    saveState();
    renderChatFontStyle();
  });

  document.getElementById('settings-bubble-mode').addEventListener('change', (e) => {
    settingsChat.bubbleStyle.mode = e.target.value;
    saveState();
    renderSettingsTampilanTab();
    updateMessagePerspective();
  });
  document.getElementById('settings-bubble-c1').addEventListener('input', (e) => {
    settingsChat.bubbleStyle.c1 = e.target.value;
    saveState();
    document.getElementById('settings-bubble-preview').style.background = bubbleBackgroundCss(settingsChat.bubbleStyle);
    updateMessagePerspective();
  });
  document.getElementById('settings-bubble-c2').addEventListener('input', (e) => {
    settingsChat.bubbleStyle.c2 = e.target.value;
    saveState();
    document.getElementById('settings-bubble-preview').style.background = bubbleBackgroundCss(settingsChat.bubbleStyle);
    updateMessagePerspective();
  });

  document.getElementById('settings-action-color').addEventListener('input', (e) => {
    settingsChat.actionColor = e.target.value;
    saveState();
    renderChatFontStyle();
  });
}

// ---------------------------------------------------------------
// Pengaturan Aplikasi (global): tema, cadangkan/pulihkan semua chat
// ---------------------------------------------------------------
function openAppSettings(){
  document.getElementById('app-settings-action-color').value = appPrefs.actionColor;
  openModal('modal-app-settings');
}

function initAppSettingsEvents(){
  document.getElementById('app-settings-action-color').addEventListener('input', (e) => {
    appPrefs.actionColor = e.target.value;
    saveAppPrefs();
    if(!document.getElementById('screen-chat').classList.contains('active')){
      document.body.style.setProperty('--action-color', appPrefs.actionColor);
    }
  });
}
