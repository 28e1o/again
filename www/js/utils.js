// ===================================================================
// utils.js — helper kecil lintas modul (tidak menyimpan state)
// ===================================================================

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function initials(name){
  return (name||'?').trim().slice(0,1).toUpperCase();
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

function wordCount(text){
  if(!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Menghasilkan CSS background dari bubbleStyle chat: solid atau gradient.
function bubbleBackgroundCss(bubbleStyle){
  if(!bubbleStyle) return '#0084ff';
  if(bubbleStyle.mode === 'gradient'){
    return `linear-gradient(135deg, ${bubbleStyle.c1}, ${bubbleStyle.c2})`;
  }
  return bubbleStyle.c1 || '#0084ff';
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

// Debounce sederhana (dipakai untuk autosave draft & pencarian)
function debounce(fn, ms){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
