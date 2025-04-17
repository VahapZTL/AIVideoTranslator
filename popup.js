// Popup açıldığında gerekli olabilecek işlemler için
document.addEventListener('DOMContentLoaded', () => {
  // Kaydedilmiş dil tercihini yükle
  chrome.storage.local.get(['targetLanguage'], (result) => {
    if (result.targetLanguage) {
      document.getElementById('targetLang').value = result.targetLanguage;
    }
  });

  // Dil seçimi değiştiğinde kaydet
  document.getElementById('targetLang').addEventListener('change', (e) => {
    const targetLang = e.target.value;
    chrome.storage.local.set({ targetLanguage: targetLang }, () => {
      showStatus('Dil tercihi kaydedildi', 'success');
    });
  });
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
} 