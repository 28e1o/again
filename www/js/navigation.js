// ===================================================================
// navigation.js — pindah layar/modal + tombol back fisik Android
// ===================================================================

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
function closeAllModals(){
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// tombol back fisik Android: tutup dropdown -> modal/viewer yang terbuka dulu,
// lalu kalau lagi di layar chat kembali ke daftar chat, dan hanya
// keluar aplikasi kalau memang sudah di halaman utama.
function handleHardwareBack(){
  const openDropdown = document.querySelector('.dropdown-menu.active');
  if(openDropdown){ openDropdown.classList.remove('active'); return; }

  const activeModal = document.querySelector('.modal-overlay.active');
  if(activeModal){
    activeModal.classList.remove('active');
    return;
  }
  if(document.getElementById('media-viewer').classList.contains('active')){
    closeMediaViewer();
    return;
  }
  if(document.getElementById('screen-chat').classList.contains('active')){
    leaveChatScreen();
    return;
  }
  // Sudah di halaman utama -> baru boleh keluar aplikasi
  if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
    Capacitor.Plugins.App.exitApp();
  }
}

function initHardwareBack(){
  if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
    // Capacitor native: dengarkan event tombol back fisik Android
    Capacitor.Plugins.App.addListener('backButton', handleHardwareBack);
  } else {
    // Fallback untuk browser biasa (bukan build Android)
    window.addEventListener('popstate', handleHardwareBack);
  }
}
