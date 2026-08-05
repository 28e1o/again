// ===================================================================
// main.js — bootstrap: pasang semua event listener saat DOM siap
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  document.body.style.setProperty('--action-color', appPrefs.actionColor);
  renderChatList();
  initHardwareBack();
  initHomeSearch();
  initHomeTabs();
  initChatSearch();
  initRoleDropdown();
  initSettingsTabs();
  initSettingsTampilanEvents();
  initAppSettingsEvents();

  // ---------------- Tema ----------------
  const applyTheme = () => document.body.classList.toggle('dark', localStorage.getItem('rp_theme') === 'dark');
  applyTheme();
  document.getElementById('btn-theme').addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('rp_theme', dark ? 'dark' : 'light');
  });

  // ---------------- Pengaturan Aplikasi (ikon di Home) ----------------
  document.getElementById('btn-open-settings-home').addEventListener('click', openAppSettings);
  document.getElementById('app-settings-close').addEventListener('click', () => closeModal('modal-app-settings'));
  document.getElementById('btn-export-all').addEventListener('click', exportAllChats);
  document.getElementById('btn-import-all').addEventListener('click', triggerImportFile);
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);

  // ---------------- Menu tambah baru (FAB) ----------------
  document.getElementById('btn-fab').addEventListener('click', () => openModal('modal-new'));
  document.getElementById('opt-cancel-new').addEventListener('click', () => closeModal('modal-new'));
  document.getElementById('opt-new-character').addEventListener('click', () => { closeModal('modal-new'); openCharacterForm(); });
  document.getElementById('opt-new-group').addEventListener('click', () => { closeModal('modal-new'); openGroupForm(); });

  // ---------------- Form karakter & grup baru ----------------
  document.getElementById('char-cancel').addEventListener('click', () => closeModal('modal-character-form'));
  document.getElementById('char-save').addEventListener('click', saveNewCharacter);
  document.getElementById('group-cancel').addEventListener('click', () => closeModal('modal-group-form'));
  document.getElementById('group-save').addEventListener('click', saveNewGroup);
  document.getElementById('btn-add-member').addEventListener('click', addMemberRow);
  document.getElementById('btn-add-member-settings').addEventListener('click', addMember);

  // ---------------- Chat row menu (pin / hapus) ----------------
  document.getElementById('chat-menu-cancel').addEventListener('click', () => closeModal('modal-chat-row-menu'));
  document.getElementById('chat-menu-pin').addEventListener('click', handleTogglePinFromMenu);
  document.getElementById('chat-menu-delete').addEventListener('click', handleDeleteChatFromMenu);
  document.getElementById('chat-menu-export').addEventListener('click', () => {
    if(longPressChatTarget){
      const prevId = state.currentChatId;
      state.currentChatId = longPressChatTarget.id;
      exportCurrentChat();
      state.currentChatId = prevId;
    }
    closeModal('modal-chat-row-menu');
  });

  // ---------------- Layar chat: navigasi & header ----------------
  document.getElementById('btn-back').addEventListener('click', leaveChatScreen);
  document.getElementById('btn-chat-settings').addEventListener('click', openChatSettings);
  document.getElementById('settings-close').addEventListener('click', () => closeModal('modal-chat-settings'));
  document.getElementById('btn-chat-export').addEventListener('click', exportCurrentChat);

  // ---------------- Komposer pesan ----------------
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });
  document.getElementById('msg-input').addEventListener('input', autosaveDraft);
  document.getElementById('btn-narration').addEventListener('click', toggleNarrationMode);
  document.getElementById('reply-preview-remove').addEventListener('click', clearReply);

  document.getElementById('btn-attach').addEventListener('click', () => document.getElementById('media-input').click());
  document.getElementById('media-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) handleMediaFile(file);
  });
  document.getElementById('media-preview-remove').addEventListener('click', clearPendingMedia);

  document.getElementById('media-convert-voice').addEventListener('click', async () => {
    if(!pendingMedia || pendingMedia.type !== 'video') return;
    const nameEl = document.getElementById('media-preview-name');
    const thumbEl = document.getElementById('media-preview-thumb');
    const btn = document.getElementById('media-convert-voice');
    btn.style.pointerEvents = 'none';
    btn.textContent = 'Memproses...';
    thumbEl.innerHTML = '<div class="convert-spinner"></div>';
    nameEl.textContent = 'Mengubah ke pesan suara... 0 detik';

    // beri jeda 1 frame supaya browser sempat menggambar teks/spinner di atas
    // dulu sebelum proses berat (encode audio) mulai memblokir main thread —
    // ini penyebab loading kadang "tidak muncul" sama sekali.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const startedAt = Date.now();
    const progressTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      nameEl.textContent = `Mengubah ke pesan suara... ${elapsed} detik`;
    }, 500);

    try{
      const res = await videoToVoice(pendingMedia.dataUrl);
      pendingMedia = { type: 'audio', dataUrl: res.dataUrl, duration: res.duration };
      btn.style.display = 'none';
      thumbEl.innerHTML = '<div class="voice-preview-thumb">🎙️</div>';
      nameEl.textContent = 'Pesan suara · ' + formatDur(res.duration);
    }catch(err){
      alert('Gagal mengonversi: ' + (err && err.message || err));
      thumbEl.innerHTML = '';
      const vid = document.createElement('video');
      vid.src = pendingMedia.dataUrl; vid.muted = true;
      thumbEl.appendChild(vid);
      nameEl.textContent = 'Video siap dikirim';
      btn.textContent = '🎙️ Jadikan suara';
    }finally{
      clearInterval(progressTimer);
      btn.style.pointerEvents = '';
    }
  });

  // ---------------- Media viewer ----------------
  document.getElementById('media-viewer-close').addEventListener('click', closeMediaViewer);
  document.getElementById('media-viewer').addEventListener('click', (e) => {
    if(e.target.id === 'media-viewer') closeMediaViewer();
  });

  // ---------------- Menu aksi pesan: Balas / Reaksi / Salin / Edit / Hapus ----------------
  document.getElementById('opt-cancel-msg-actions').addEventListener('click', () => closeModal('modal-msg-actions'));

  document.getElementById('opt-reply-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg) return;
    const chat = getCurrentChat();
    const role = chat.roles.find(r => r.id === activeActionMsg.roleId) || { name: 'Narasi' };
    startReply(chat, activeActionMsg, role);
  });

  document.getElementById('opt-react-message').addEventListener('click', openReactionPicker);

  document.getElementById('opt-copy-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg || !activeActionMsg.text) return;
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(activeActionMsg.text);
  });

  document.getElementById('opt-edit-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg) return;
    document.getElementById('edit-message-text').value = activeActionMsg.text || '';
    openModal('modal-edit-message');
  });

  document.getElementById('opt-delete-message').addEventListener('click', () => {
    closeModal('modal-msg-actions');
    if(!activeActionMsg) return;
    if(!confirm('Hapus pesan ini? Tindakan ini tidak bisa dibatalkan.')) return;
    const chat = getCurrentChat();
    chat.messages = chat.messages.filter(m => m.id !== activeActionMsg.id);
    deleteMediaForMessage(activeActionMsg);
    saveState();
    renderMessages(false);
    renderChatList();
  });

  document.getElementById('edit-message-cancel').addEventListener('click', () => closeModal('modal-edit-message'));
  document.getElementById('edit-message-save').addEventListener('click', () => {
    if(!activeActionMsg) return;
    const chat = getCurrentChat();
    const target = chat.messages.find(m => m.id === activeActionMsg.id);
    if(target){
      const newText = document.getElementById('edit-message-text').value.trim();
      if(!newText && !target.media){ alert('Pesan tidak boleh kosong.'); return; }
      target.text = newText || undefined;
      target.edited = true;
      saveState();
      renderMessages(false);
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
});
