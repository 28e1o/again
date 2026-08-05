// ===================================================================
// state.js — data global aplikasi + persistence
//
// Di build Android (Capacitor) data disimpan sebagai FILE asli di
// penyimpanan aplikasi lewat @capacitor/filesystem (Directory.Data),
// sehingga tidak lagi terbatas ±5MB localStorage. Chat JSON disimpan di
// 'rp_state.json', preferensi di 'rp_prefs.json', dan foto/video/pesan
// suara disimpan sebagai file terpisah di folder 'media/' — pesan hanya
// menyimpan referensi (fileName), bukan base64 raksasa.
//
// Di browser (pratinjau web) tetap pakai localStorage seperti dulu.
// ===================================================================

const STORAGE_KEY = 'rp_chats_v1';
const APP_PREF_KEY = 'rp_app_prefs_v1';
const STORAGE_FILE = 'rp_state.json';
const PREFS_FILE = 'rp_prefs.json';
const AVATAR_COLORS = ['#6b7fd7','#f97aa1','#3ecf8e','#f2a94e','#a06bd7','#e5555f','#4ba3c3','#8f9a3c'];
const REACTION_EMOJIS = ['❤️','😂','😮','😢','👍','🔥'];

let state = {
  chats: [],        // lihat migrasi di bawah untuk daftar field lengkap tiap chat
  currentChatId: null
};

// preferensi level-aplikasi (bukan per-chat)
let appPrefs = {
  actionColor: '#e5555f' // warna default aksi (hapus/aksesori) — bisa disesuaikan per-chat
};

// ---------------------------------------------------------------
// Deteksi lingkungan + helper @capacitor/filesystem (native saja)
// ---------------------------------------------------------------
const isNative = typeof window !== 'undefined'
  && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function capFS(){
  if(!isNative) return null;
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null;
}

function capConvertFileSrc(path){
  if(!window.Capacitor) return path;
  const fs = window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if(fs && typeof fs.convertFileSrc === 'function') return fs.convertFileSrc(path);
  if(typeof window.Capacitor.convertFileSrc === 'function') return window.Capacitor.convertFileSrc(path);
  return path;
}

async function writeTextFile(fileName, text){
  const fs = capFS();
  if(!fs) return;
  await fs.writeFile({ path: fileName, data: text, directory: 'DATA', encoding: 'UTF8' });
}

async function readTextFile(fileName){
  const fs = capFS();
  if(!fs) return null;
  const res = await fs.readFile({ path: fileName, directory: 'DATA', encoding: 'UTF8' });
  return typeof res.data === 'string' ? res.data : null;
}

// Ekstrak mime (mis. 'video/mp4') dari dataUrl (mis. 'data:video/mp4;base64,...')
function mimeOf(dataUrl){
  if(!dataUrl) return '';
  const m = String(dataUrl).match(/^data:([^;]+)/);
  return m ? m[1] : '';
}

function mediaExt(media){
  const d = media.dataUrl || '';
  if(media.type === 'video') return 'mp4';
  if(media.type === 'audio'){
    if(d.includes('audio/mp4')) return 'm4a';
    if(d.includes('audio/wav') || d.includes('audio/x-wav')) return 'wav';
    if(d.includes('audio/mpeg')) return 'mp3';
    return 'webm';
  }
  if(d.includes('image/png')) return 'png';
  if(d.includes('image/webp')) return 'webp';
  if(d.includes('image/gif')) return 'gif';
  return 'jpg';
}

// Simpan media pesan sebagai file asli (native). Di browser tidak
// dilakukan — media tetap dataUrl di dalam state.
async function persistMedia(msg){
  const media = msg && msg.media;
  if(!media || !media.dataUrl) return;
  if(!isNative) return;
  const fs = capFS();
  if(!fs) return;
  try{
    try{ await fs.mkdir({ path: 'media', directory: 'DATA', recursive: true }); }catch(e){}
    const ext = mediaExt(media);
    const fileName = 'media/' + msg.id + '_' + Date.now().toString(36) + '.' + ext;
    await fs.writeFile({ path: fileName, data: media.dataUrl, directory: 'DATA', recursive: true });
    media.fileName = fileName;
    media.mime = mimeOf(media.dataUrl) || media.mime;
    delete media.dataUrl;
  }catch(e){
    console.error('Gagal menyimpan media', e);
  }
}

// URL yang bisa ditampilkan <img>/<video>/<audio>. Untuk media yang sudah
// jadi file native, resolusi path -> kapasitor:// butuh operasi async.
async function mediaSrcAsync(media){
  if(!media) return '';
  if(media.dataUrl) return media.dataUrl;
  if(media.fileName && isNative){
    try{
      const fs = capFS();
      const { uri } = await fs.getUri({ path: media.fileName, directory: 'DATA' });
      return capConvertFileSrc(uri);
    }catch(e){
      console.error('Gagal membuka media', e);
      return '';
    }
  }
  return media.dataUrl || '';
}

// Tempelkan src pada elemen setelah path media selesai di-resolve.
function setMediaSrc(el, media){
  mediaSrcAsync(media).then(src => { if(src && el) el.src = src; });
}

async function deleteMediaForMessage(msg){
  const media = msg && msg.media;
  if(!media || !media.fileName || !isNative) return;
  try{
    const fs = capFS();
    await fs.deleteFile({ path: media.fileName, directory: 'DATA' });
  }catch(e){ /* file mungkin sudah hilang */ }
}

async function deleteChatMedia(chat){
  if(!chat || !chat.messages) return;
  for(const m of chat.messages){
    if(m && m.media && m.media.fileName) await deleteMediaForMessage(m);
  }
}

// ---------------------------------------------------------------
// Memuat / menyimpan state
// ---------------------------------------------------------------
async function loadState(){
  let loadedFromFile = false;

  if(isNative){
    // 1) coba baca file versi terbaru
    try{
      const raw = await readTextFile(STORAGE_FILE);
      if(raw){ state.chats = JSON.parse(raw); loadedFromFile = true; }
    }catch(e){ console.error('Gagal memuat data', e); state.chats = []; }
    try{
      const rawPrefs = await readTextFile(PREFS_FILE);
      if(rawPrefs) appPrefs = Object.assign(appPrefs, JSON.parse(rawPrefs));
    }catch(e){ /* abaikan */ }

    // 2) upgrade dari build lama yang masih pakai localStorage
    if(!loadedFromFile){
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        if(raw) state.chats = JSON.parse(raw);
      }catch(e){ state.chats = []; }
      try{
        const rawPrefs = localStorage.getItem(APP_PREF_KEY);
        if(rawPrefs) appPrefs = Object.assign(appPrefs, JSON.parse(rawPrefs));
      }catch(e){ /* abaikan */ }
    }
  } else {
    // Browser: localStorage seperti sebelumnya
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ state.chats = JSON.parse(raw); }
    }catch(e){ console.error('Gagal memuat data', e); state.chats = []; }
    try{
      const rawPrefs = localStorage.getItem(APP_PREF_KEY);
      if(rawPrefs) appPrefs = Object.assign(appPrefs, JSON.parse(rawPrefs));
    }catch(e){ /* abaikan */ }
  }

  migrateChats(state.chats);

  // sekali waktu di build native: pindahkan media base64 lama -> file asli
  if(isNative){
    await migrateMediaToFiles();
    await saveState(); // simpan ke file + bersihkan localStorage lama
  }
}

// migrasi data lama supaya field-field baru selalu ada nilainya
function migrateChats(chats){
  chats.forEach(chat => {
    if(chat.avatarUrl === undefined) chat.avatarUrl = null;
    if(!chat.background) chat.background = { imageUrl: null, opacity: 1 };
    if(chat.bio === undefined) chat.bio = '';
    if(!chat.fontFamily) chat.fontFamily = 'system';
    if(!chat.fontSize) chat.fontSize = 15;
    if(chat.pinned === undefined) chat.pinned = false;
    if(chat.lastOpenedAt === undefined) chat.lastOpenedAt = chat.messages && chat.messages.length ? Date.now() : 0;
    if(chat.draft === undefined) chat.draft = '';
    if(!chat.actionColor) chat.actionColor = appPrefs.actionColor;

    // warna/gradient bubble milikmu: migrasi dari field lama 'myBubbleColor' (string)
    if(!chat.bubbleStyle){
      chat.bubbleStyle = { mode: 'solid', c1: chat.myBubbleColor || '#0084ff', c2: '#00c6ff' };
    }
    delete chat.myBubbleColor;

    if(chat.roles){
      chat.roles.forEach(r => {
        if(r.avatarUrl === undefined) r.avatarUrl = null;
        if(r.bio === undefined) r.bio = '';
      });
      const charRole = chat.roles.find(r => r.type === 'other');
      if(chat.avatarUrl && charRole && !charRole.avatarUrl) charRole.avatarUrl = chat.avatarUrl;
      if(chat.bio && charRole && !charRole.bio) charRole.bio = chat.bio;
    }

    if(chat.messages){
      chat.messages.forEach(m => {
        if(m.reaction === undefined) m.reaction = null;
        if(m.isNarration === undefined) m.isNarration = false;
      });
    }
  });
}

// pindahkan semua media base64 (dari build lama) menjadi file asli
async function migrateMediaToFiles(){
  for(const chat of state.chats){
    if(!chat.messages) continue;
    for(const msg of chat.messages){
      if(msg.media && msg.media.dataUrl && !msg.media.fileName){
        await persistMedia(msg);
      }
    }
  }
}

async function saveState(){
  if(isNative){
    try{
      await writeTextFile(STORAGE_FILE, JSON.stringify(state.chats));
      try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    }catch(e){
      console.error('Gagal menyimpan data', e);
      alert('Gagal menyimpan: penyimpanan tidak bisa ditulis.');
    }
  } else {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats)); }
    catch(e){ console.error('Gagal menyimpan data', e); alert('Gagal menyimpan: penyimpanan mungkin penuh (terlalu banyak foto/video besar).'); }
  }
}

async function saveAppPrefs(){
  if(isNative){
    try{
      await writeTextFile(PREFS_FILE, JSON.stringify(appPrefs));
      try{ localStorage.removeItem(APP_PREF_KEY); }catch(e){}
    }catch(e){ console.error('Gagal menyimpan preferensi', e); }
  } else {
    try{ localStorage.setItem(APP_PREF_KEY, JSON.stringify(appPrefs)); }
    catch(e){ console.error('Gagal menyimpan preferensi', e); }
  }
}

function getCurrentChat(){
  return state.chats.find(c => c.id === state.currentChatId);
}

// Semua role "milikmu" (persona) di sebuah chat — satu chat bisa punya lebih dari satu.
function myRoles(chat){ return chat.roles.filter(r => r.type === 'me'); }
// Semua role "lawan bicara" (karakter 1v1, atau anggota grup).
function otherRoles(chat){ return chat.roles.filter(r => r.type === 'other'); }
