// ===================================================================
// dataTransfer.js — ekspor/impor chat sebagai file JSON (cadangan)
// ===================================================================

// Di build native, media disimpan sebagai file terpisah (bukan base64 di
// dalam state). Saat mengekspor, file-file tersebut disisipkan kembali
// sebagai dataUrl supaya cadangan tetap lengkap & bisa dipindah.
async function buildExportObj(obj){
  const clone = JSON.parse(JSON.stringify(obj));
  if(!isNative) return clone;
  const chats = Array.isArray(clone) ? clone
    : Array.isArray(clone.chats) ? clone.chats
    : (clone.id && clone.roles) ? [clone]
    : [];
  for(const chat of chats){
    for(const msg of chat.messages || []){
      if(msg.media && msg.media.fileName){
        try{
          const fs = capFS();
          const { data } = await fs.readFile({ path: msg.media.fileName, directory: 'DATA' });
          if(data){
            msg.media.dataUrl = 'data:' + (msg.media.mime || 'application/octet-stream') + ';base64,' + data;
          }
          delete msg.media.fileName;
        }catch(e){
          console.error('Gagal membaca media untuk ekspor', e);
          delete msg.media.fileName;
        }
      }
    }
  }
  return clone;
}

async function exportCurrentChat(){
  const chat = getCurrentChat();
  const payload = await buildExportObj(chat);
  downloadJson(payload, `rpchat-${chat.name.replace(/[^a-z0-9]+/gi,'_')}.json`);
}

async function exportAllChats(){
  const payload = await buildExportObj({ exportedAt: Date.now(), chats: state.chats });
  downloadJson(payload, `rpchat-backup-${new Date().toISOString().slice(0,10)}.json`);
}

function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function triggerImportFile(){
  document.getElementById('import-file-input').click();
}

async function importChatsData(incoming){
  let added = 0, renamed = 0;
  for(const chat of incoming){
    // media hasil impor berformat dataUrl -> simpan ulang jadi file asli
    for(const msg of chat.messages || []){
      if(msg.media && msg.media.dataUrl && !msg.media.fileName){
        await persistMedia(msg);
      }
    }
    if(state.chats.find(c => c.id === chat.id)){
      chat.id = uid(); // hindari tabrakan id dengan chat yang sudah ada
      renamed++;
    }
    state.chats.push(chat);
    added++;
  }
  await saveState();
  renderChatList();
  alert(`Berhasil impor ${added} chat.` + (renamed ? ` (${renamed} di antaranya diberi ID baru karena bentrok)` : ''));
}

function handleImportFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const incoming = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.chats) ? parsed.chats
        : (parsed.id && parsed.roles) ? [parsed]
        : null;
      if(!incoming) throw new Error('Format file tidak dikenali');

      migrateChats(incoming);
      importChatsData(incoming);
    }catch(err){
      alert('Gagal impor: file bukan cadangan RP Chat yang valid.');
      console.error(err);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
