// ===================================================================
// chatCreate.js — membuat chat karakter (1v1) baru & grup baru
// ===================================================================

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

function newChatDefaults(){
  return {
    avatarUrl: null,
    background: { imageUrl: null, opacity: 1 },
    bio: '',
    fontFamily: 'system',
    fontSize: 15,
    pinned: false,
    lastOpenedAt: 0,
    draft: '',
    actionColor: appPrefs.actionColor,
    bubbleStyle: { mode: 'solid', c1: '#0084ff', c2: '#00c6ff' },
    messages: []
  };
}

function saveNewCharacter(){
  const name = document.getElementById('char-name').value.trim();
  if(!name){ alert('Isi nama karakter dulu ya.'); return; }

  const chat = Object.assign({
    id: uid(),
    type: 'character',
    name: name,
    color: selectedColor,
    roles: [
      { id:'me', name:'Aku', type:'me', color:'#0084ff', avatarUrl:null, bio:'' },
      { id:'char', name:name, type:'other', color:selectedColor, avatarUrl:null, bio:'' }
    ],
    activeRoleId: 'me'
  }, newChatDefaults());

  state.chats.push(chat);
  saveState();
  closeModal('modal-character-form');
  renderChatList();
  openChat(chat.id);
}

// ---------------------------------------------------------------
// Grup baru
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

  const roles = [{ id:'me', name:'Aku', type:'me', color:'#0084ff', avatarUrl:null, bio:'' }];
  members.forEach((m, idx) => {
    roles.push({ id: 'm'+idx+'_'+uid(), name: m, type:'other', color: AVATAR_COLORS[idx % AVATAR_COLORS.length], avatarUrl:null, bio:'' });
  });

  const chat = Object.assign({
    id: uid(),
    type: 'group',
    name: name,
    color: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)],
    roles: roles,
    activeRoleId: 'me'
  }, newChatDefaults());

  state.chats.push(chat);
  saveState();
  closeModal('modal-group-form');
  renderChatList();
  openChat(chat.id);
}
