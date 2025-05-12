console.log("[RJ ImageFX Auto] Background service worker started.");

// Inisialisasi status otomasi di storage saat ekstensi diinstal/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("isAutomating", (data) => {
    if (typeof data.isAutomating === 'undefined') {
      chrome.storage.local.set({ isAutomating: false });
      console.log("[RJ ImageFX Auto] 'isAutomating' initialized to false in storage.");
    }
  });
});

// Fungsi untuk mengirim pesan ke content script di tab aktif
function sendMessageToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[RJ ImageFX Auto] Error sending message to content script:", chrome.runtime.lastError.message);
          // Ini bisa terjadi jika content script belum siap atau halaman tidak cocok
        } else {
          console.log("[RJ ImageFX Auto] Message sent to content script, response:", response);
        }
      });
    } else {
      console.warn("[RJ ImageFX Auto] No active tab found to send message.");
    }
  });
}

// Listener untuk pesan dari popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[RJ ImageFX Auto] Background received message: ", request);
  if (request.action === "start") {
    chrome.storage.local.set({ isAutomating: true }, () => {
      console.log("[RJ ImageFX Auto] 'isAutomating' set to true in storage.");
      sendMessageToActiveTab({ command: "startAutomation" });
      sendResponse({ status: "Automation start command sent to content script." });
    });
    return true; // Indicates asynchronous response
  } else if (request.action === "stop") {
    chrome.storage.local.set({ isAutomating: false }, () => {
      console.log("[RJ ImageFX Auto] 'isAutomating' set to false in storage (cycleInProgress will be handled by content script).");
      sendMessageToActiveTab({ command: "stopAutomation" });
      sendResponse({ status: "Automation stop command sent to content script." });
    });
    return true; // Indicates asynchronous response
  }
  // Pesan untuk mengontrol visibilitas floating controls
  else if (request.action === "showFloatingControls") {
    console.log("[RJ ImageFX Auto Background] Received showFloatingControls, forwarding to content script.");
    sendMessageToActiveTab({ command: "showFloatingControls" });
    // Tidak perlu response khusus ke popup untuk ini
  }
  else if (request.action === "hideFloatingControls") {
    console.log("[RJ ImageFX Auto Background] Received hideFloatingControls, forwarding to content script.");
    sendMessageToActiveTab({ command: "hideFloatingControls" });
    // Tidak perlu response khusus ke popup untuk ini
  }
  return false; // No asynchronous response if action is not handled (atau true jika ada async di atasnya yang tidak return)
}); 