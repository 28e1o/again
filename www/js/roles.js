// ===================================================================
// roles.js — ganti sudut pandang (peran aktif) + dropdown pilihan peran
// ===================================================================

// Peran aktif menentukan sudut pandang: pesan dari peran yang SEDANG aktif
// selalu tampil di kanan dengan warna bubble-mu ("aku"), semua pesan dari
// peran lain tampil di kiri — berubah setiap kali kamu ganti peran,
// termasuk untuk pesan-pesan lama yang sudah terkirim sebelumnya.
function setActiveRole(roleId){
  const chat = getCurrentChat();
  if(!chat.roles.find(r => r.id === roleId)) return;
  chat.activeRoleId = roleId;
  saveState();

  renderChatHeaderIdentity();
  renderBioBanner();
  updateMessagePerspective();
  closeRoleDropdown();
}

// tombol utama: siklus cepat ke peran berikutnya
function switchRole(){
  const chat = getCurrentChat();
  const idx = chat.roles.findIndex(r => r.id === chat.activeRoleId);
  const nextIdx = (idx + 1) % chat.roles.length;
  setActiveRole(chat.roles[nextIdx].id);

  const btn = document.getElementById('btn-switch-role');
  btn.classList.add('spin');
  setTimeout(() => btn.classList.remove('spin'), 300);
}

// tekan-tahan / klik ikon dropdown kecil: tampilkan semua pilihan peran
function openRoleDropdown(){
  const chat = getCurrentChat();
  const menu = document.getElementById('role-dropdown-menu');
  menu.innerHTML = '';
  chat.roles.forEach(role => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'dropdown-item' + (role.id === chat.activeRoleId ? ' active' : '');
    item.innerHTML = `
      <span class="dropdown-avatar" style="background:${role.color}">
        ${role.avatarUrl ? `<img src="${role.avatarUrl}">` : initials(role.name)}
      </span>
      <span class="dropdown-item-name">${escapeHtml(role.name)}</span>
      <span class="dropdown-item-tag">${role.type === 'me' ? 'Persona' : 'Karakter'}</span>
    `;
    item.addEventListener('click', () => setActiveRole(role.id));
    menu.appendChild(item);
  });
  menu.classList.add('active');
}

function closeRoleDropdown(){
  document.getElementById('role-dropdown-menu').classList.remove('active');
}

function initRoleDropdown(){
  const btn = document.getElementById('btn-switch-role');
  let pressTimer = null;
  btn.addEventListener('click', switchRole);
  // tekan-tahan tombol ganti peran -> buka dropdown daftar lengkap
  btn.addEventListener('pointerdown', () => { pressTimer = setTimeout(openRoleDropdown, 420); });
  const cancel = () => { if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; } };
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);

  document.getElementById('role-dropdown-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('role-dropdown-menu');
    menu.classList.contains('active') ? closeRoleDropdown() : openRoleDropdown();
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('role-dropdown-menu');
    if(menu.classList.contains('active') && !menu.contains(e.target) && e.target.id !== 'role-dropdown-toggle'){
      closeRoleDropdown();
    }
  });
}
