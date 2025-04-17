// Çeviri durumu için global değişkenler
let isTranslating = false;
let progressBar = null;

// Progress bar oluşturma
function createProgressBar() {
  const progressContainer = document.createElement('div');
  progressContainer.className = 'translation-progress-container';
  
  const progress = document.createElement('div');
  progress.className = 'translation-progress';
  
  const text = document.createElement('div');
  text.className = 'translation-progress-text';
  
  progressContainer.appendChild(progress);
  progressContainer.appendChild(text);
  
  document.body.appendChild(progressContainer);
  
  return {
    container: progressContainer,
    bar: progress,
    text: text,
    update: (percent, message) => {
      progress.style.width = `${percent}%`;
      text.textContent = message;
    },
    hide: () => {
      progressContainer.style.display = 'none';
    },
    show: () => {
      progressContainer.style.display = 'block';
    }
  };
}

// Sayfa yüklendiğinde ve URL değişikliklerinde çalışacak şekilde güncelleyelim
function init() {
    console.log("Video Çevirmen: İçerik betiği başlatılıyor...");
    
    // Video ve ayarlar butonunu bulmak için tekrarlı kontrol
    const checkElements = setInterval(() => {
        const video = document.querySelector('video');
        const settingsButton = document.querySelector('.ytp-settings-button');
        
        console.log("Video elementi:", video ? "bulundu" : "bulunamadı");
        console.log("Ayarlar butonu:", settingsButton ? "bulundu" : "bulunamadı");
        
        if (video && settingsButton) {
            clearInterval(checkElements);
            initializeTranslationButton();
        }
    }, 1000); // Her saniye kontrol et
}

// Video oynatıcıyı bulma ve çeviri butonu ekleme
function initializeTranslationButton() {
    console.log("Çeviri butonu ekleniyor...");
    
    const video = document.querySelector('video');
    const settingsButton = document.querySelector('.ytp-settings-button');
    
    if (!video || !settingsButton) {
        console.log("Gerekli elementler bulunamadı!");
        return;
    }

    // Eğer buton zaten eklenmişse tekrar ekleme
    if (document.querySelector('.translate-button')) {
        console.log("Çeviri butonu zaten mevcut!");
        return;
    }

    // Çeviri butonu oluşturma
    const translateButton = document.createElement('button');
    translateButton.className = 'ytp-button translate-button';
    translateButton.innerHTML = '🌐';
    translateButton.title = 'Altyazıları Çevir';
    
    // Butonu ayarlar butonunun yanına ekle
    settingsButton.parentNode.insertBefore(translateButton, settingsButton.nextSibling);
    console.log("Çeviri butonu başarıyla eklendi!");

    // Çeviri butonu tıklama olayı
    translateButton.addEventListener('click', async () => {
      if (isTranslating) {
        alert('Çeviri işlemi devam ediyor, lütfen bekleyin...');
        return;
      }

      try {
        isTranslating = true;
        if (!progressBar) {
          progressBar = createProgressBar();
        }
        progressBar.show();
        progressBar.update(0, 'Altyazılar çıkarılıyor...');

        const subtitles = await extractSubtitles();
        if (subtitles.length === 0) {
          throw new Error('Altyazı bulunamadı!');
        }

        // Hedef dili al
        const { targetLanguage } = await chrome.storage.local.get(['targetLanguage']);
        const targetLang = targetLanguage || 'tr';

        // Önbellekten kontrol et
        const cacheKey = `${window.location.href}_${targetLang}`;
        const cachedTranslation = await getCachedTranslation(cacheKey);
        
        if (cachedTranslation) {
          progressBar.update(100, 'Önbellekten çeviriler yükleniyor...');
          await replaceSubtitles(cachedTranslation);
          video.play();
        } else {
          const translatedSubtitles = await translateSubtitles(subtitles, targetLang);
          await cacheTranslation(cacheKey, translatedSubtitles);
          await replaceSubtitles(translatedSubtitles);
          video.play();
        }
      } catch (error) {
        alert(`Hata: ${error.message}`);
      } finally {
        isTranslating = false;
        if (progressBar) {
          setTimeout(() => progressBar.hide(), 1000);
        }
      }
    });
}

// Önbellekten çeviri al
async function getCachedTranslation(key) {
  const result = await chrome.storage.local.get([key]);
  return result[key];
}

// Çeviriyi önbelleğe kaydet
async function cacheTranslation(key, translations) {
  await chrome.storage.local.set({ [key]: translations });
}

// Altyazıları çıkarma
async function extractSubtitles() {
  const tracks = document.querySelector('video').textTracks;
  const subtitles = [];
  
  for (let track of tracks) {
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      track.mode = 'showing';
      const cues = track.cues;
      
      for (let cue of cues) {
        subtitles.push({
          startTime: cue.startTime,
          endTime: cue.endTime,
          text: cue.text
        });
      }
    }
  }
  
  return subtitles;
}

// Altyazıları çevirme
async function translateSubtitles(subtitles, targetLang) {
  const translatedSubtitles = [];
  const totalSubtitles = subtitles.length;
  
  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small3.1:latest',
          prompt: `Translate the following text to ${getLanguageName(targetLang)}: "${subtitle.text}"`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API yanıt hatası: ${response.status}`);
      }

      const result = await response.json();
      translatedSubtitles.push({
        ...subtitle,
        text: result.response
      });

      // İlerleme çubuğunu güncelle
      const progress = ((i + 1) / totalSubtitles) * 100;
      progressBar.update(progress, `Çeviriliyor... (${i + 1}/${totalSubtitles})`);
    } catch (error) {
      console.error(`Çeviri hatası: ${error.message}`);
      translatedSubtitles.push({
        ...subtitle,
        text: `[Çeviri hatası: ${subtitle.text}]`
      });
    }
  }

  return translatedSubtitles;
}

// Dil kodundan dil adını al
function getLanguageName(langCode) {
  const languages = {
    'tr': 'Turkish',
    'en': 'English',
    'de': 'German',
    'fr': 'French',
    'es': 'Spanish',
    'it': 'Italian'
  };
  return languages[langCode] || 'Turkish';
}

// Çevrilmiş altyazıları yerleştirme
async function replaceSubtitles(translatedSubtitles) {
  const tracks = document.querySelector('video').textTracks;
  
  for (let track of tracks) {
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      const cues = track.cues;
      
      for (let i = 0; i < cues.length; i++) {
        cues[i].text = translatedSubtitles[i].text;
      }
    }
  }
}

// Sayfa yüklendiğinde ve URL değiştiğinde başlat
document.addEventListener('DOMContentLoaded', init);
document.addEventListener('yt-navigate-finish', init); // YouTube'a özel olay

// Sayfa içi gezinmeler için
let lastUrl = location.href; 
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        init();
    }
}).observe(document, {subtree: true, childList: true}); 