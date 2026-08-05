// ===================================================================
// media.js — media viewer, pesan suara, video->suara, kirim foto/video
// ===================================================================

function openMediaViewer(media){
  const viewer = document.getElementById('media-viewer');
  const stage = document.getElementById('media-viewer-stage');
  stage.innerHTML = '';
  if(media.type === 'video'){
    const vid = document.createElement('video');
    setMediaSrc(vid, media);
    vid.controls = true;
    vid.muted = true;
    vid.autoplay = true;
    vid.playsInline = true;
    stage.appendChild(vid);
  } else {
    const img = document.createElement('img');
    setMediaSrc(img, media);
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
// Pesan suara (ekstrak audio dari video + visualizer)
// ---------------------------------------------------------------
function formatDur(sec){
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function createVoiceNote(msg){
  const wrap = document.createElement('div');
  wrap.className = 'voice-note';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-play-btn';
  btn.textContent = '▶';
  const bars = document.createElement('div');
  bars.className = 'voice-visualizer';
  for(let i = 0; i < 24; i++){
    const s = document.createElement('span');
    s.style.animationDelay = (i * 0.04) + 's';
    bars.appendChild(s);
  }
  const dur = document.createElement('span');
  dur.className = 'voice-dur';
  dur.textContent = formatDur(msg.media.duration);
  wrap.appendChild(btn);
  wrap.appendChild(bars);
  wrap.appendChild(dur);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVoicePlayback(msg.media, wrap, btn);
  });
  return wrap;
}

let voicePlayer = null;

async function toggleVoicePlayback(media, wrap, btn){
  const url = await mediaSrcAsync(media);
  if(!url) return;
  if(voicePlayer && voicePlayer.wrap === wrap && voicePlayer.playing){
    voicePlayer.audio.pause();
    voicePlayer.playing = false;
    btn.textContent = '▶';
    wrap.classList.remove('playing');
    voicePlayer = null;
    return;
  }
  if(voicePlayer){
    try{ voicePlayer.audio.pause(); }catch(e){}
    voicePlayer.playing = false;
    voicePlayer.btn.textContent = '▶';
    voicePlayer.wrap.classList.remove('playing');
  }
  const audio = new Audio(url);
  voicePlayer = { audio, wrap, btn, playing: true };
  btn.textContent = '⏸';
  wrap.classList.add('playing');
  audio.addEventListener('ended', () => {
    if(voicePlayer && voicePlayer.audio === audio){
      voicePlayer.playing = false;
      voicePlayer.btn.textContent = '▶';
      voicePlayer.wrap.classList.remove('playing');
      voicePlayer = null;
    }
  });
  audio.play().catch(() => {
    btn.textContent = '▶';
    wrap.classList.remove('playing');
  });
}

function pickRecorderMime(){
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  if(typeof MediaRecorder === 'undefined') return '';
  for(const m of candidates){
    try{ if(MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m; }catch(e){}
  }
  return '';
}

// Ekstrak audio dari video (dataUrl) menjadi pesan suara.
// Cara utama: captureStream + MediaRecorder (hasil ringkas, opus/webm).
// Fallback: Web Audio OfflineAudioContext → WAV mono 16kHz.
function videoToVoice(videoDataUrl){
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement('video');
    videoEl.preload = 'auto';
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.src = videoDataUrl;
    videoEl.onerror = () => reject(new Error('Gagal memuat video'));

    const cleanup = () => {
      try{ videoEl.pause(); }catch(e){}
      videoEl.removeAttribute('src');
      try{ videoEl.load(); }catch(e){}
    };

    videoEl.onloadedmetadata = () => {
      const getDuration = () => (isFinite(videoEl.duration) && videoEl.duration > 0) ? videoEl.duration : 0;
      let duration = getDuration();
      let settled = false;

      const finish = (dataUrl) => {
        if(settled) return;
        settled = true;
        cleanup();
        resolve({ dataUrl: dataUrl, duration: duration });
      };
      const fail = (err) => {
        if(settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      const recordViaMediaRecorder = () => {
        try{
          if(typeof videoEl.captureStream !== 'function' || typeof MediaRecorder === 'undefined'){
            recordViaOffline();
            return;
          }
          const stream = videoEl.captureStream();
          const audioTracks = stream.getAudioTracks();
          if(audioTracks.length === 0){
            recordViaOffline();
            return;
          }
          const mime = pickRecorderMime();
          const rec = new MediaRecorder(new MediaStream(audioTracks), mime ? { mimeType: mime } : undefined);
          const chunks = [];
          rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = () => {
            const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
            const r = new FileReader();
            r.onloadend = () => finish(r.result);
            r.onerror = () => fail(new Error('Gagal membaca hasil audio'));
            r.readAsDataURL(blob);
          };
          rec.onerror = () => fail(new Error('Gagal merekam audio'));
          const stopRec = () => { if(rec.state !== 'inactive'){ try{ rec.stop(); }catch(e){} } };
          videoEl.addEventListener('ended', stopRec);
          rec.start();
          videoEl.play().then(() => {
            setTimeout(stopRec, Math.max(2000, duration * 1000 + 1500));
          }).catch(fail);
        }catch(e){
          recordViaOffline();
        }
      };

      const recordViaOffline = () => {
        try{
          if(typeof OfflineAudioContext === 'undefined'){
            fail(new Error('Konversi audio tidak didukung di browser ini'));
            return;
          }
          const rate = 16000;
          const len = Math.ceil(duration * rate);
          if(!isFinite(len) || len < rate) throw new Error('Durasi video tidak valid');
          const ctx = new OfflineAudioContext(1, len, rate);
          const src = ctx.createMediaElementSource(videoEl);
          src.connect(ctx.destination);
          let rendered = false;
          const render = () => {
            if(rendered) return;
            rendered = true;
            videoEl.removeEventListener('ended', render);
            videoEl.removeEventListener('timeupdate', onTime);
            ctx.startRendering().then(buffer => {
              audioBufferToWav(buffer).then(dataUrl => finish(dataUrl)).catch(fail);
            }).catch(fail);
          };
          const onTime = () => {
            if(videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.12) render();
          };
          videoEl.addEventListener('ended', render);
          videoEl.addEventListener('timeupdate', onTime);
          videoEl.muted = false;
          videoEl.play().then(() => {
            setTimeout(render, Math.max(2000, duration * 1000 + 1500));
          }).catch(fail);
        }catch(e){
          fail(e);
        }
      };

      const begin = () => {
        if(duration > 0) return recordViaMediaRecorder();
        const prevTime = videoEl.currentTime;
        const onDur = () => {
          duration = getDuration();
          if(duration > 0){
            videoEl.removeEventListener('durationchange', onDur);
            videoEl.removeEventListener('timeupdate', onDur);
            videoEl.currentTime = prevTime;
            recordViaMediaRecorder();
          }
        };
        videoEl.addEventListener('durationchange', onDur);
        videoEl.addEventListener('timeupdate', onDur);
        videoEl.currentTime = 1e7;
      };

      begin();
    };
  });
}

function audioBufferToWav(buffer){
  const numCh = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const rate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const bytes = data.length * numCh * 2;
  const ab = new ArrayBuffer(44 + bytes);
  const v = new DataView(ab);
  const ws = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * numCh * 2, true);
  v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for(let i = 0; i < data.length; i++){
    let s = Math.max(-1, Math.min(1, data[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    v.setInt16(o, s, true); o += 2;
    if(numCh === 2){ v.setInt16(o, s, true); o += 2; }
  }
  const blob = new Blob([v], { type: 'audio/wav' });
  return new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(r.result);
    r.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------
// Kirim foto / video
// ---------------------------------------------------------------
let pendingMedia = null;

function clearPendingMedia(){
  pendingMedia = null;
  document.getElementById('media-preview-bar').classList.remove('active');
  document.getElementById('media-preview-thumb').innerHTML = '';
  document.getElementById('media-preview-name').textContent = '';
  document.getElementById('media-input').value = '';
  document.getElementById('media-convert-voice').style.display = 'none';
}

function handleMediaFile(file){
  if(!file) return;
  const isVideo = file.type.startsWith('video/');

  if(isVideo && file.size > 200 * 1024 * 1024){
    alert('Video ini sangat besar (>200MB). Bisa lambat untuk dikirim dan diputar.');
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
    document.getElementById('media-convert-voice').style.display = isVideo ? 'inline-flex' : 'none';
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
