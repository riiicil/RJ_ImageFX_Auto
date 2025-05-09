// background.js - Service Worker

// Initialize state when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isRunning: false });
  console.log('Extension installed/updated. State initialized to not running.');
});

// Function to send status update to popup
function sendStatusUpdate(isRunning) {
  chrome.runtime.sendMessage({ action: 'updateStatus', isRunning: isRunning }, (response) => {
    if (chrome.runtime.lastError) {
      // Handle error, maybe the popup is not open
      // console.log("Popup not open or error sending status:", chrome.runtime.lastError.message);
    }
  });
}

// Function to send command to content script
function sendCommandToContentScript(command) {
  // Removed currentWindow: true to search across all windows
  chrome.tabs.query({ active: true, url: "*://labs.google/fx/*" }, (tabs) => {
    if (tabs.length > 0) {
      // If multiple matching tabs are active in different windows, target the first one found.
      // This might need refinement if the user has multiple ImageFX tabs active.
      const tabId = tabs[0].id;
      // Use message passing instead of executeScript for commands
      chrome.tabs.sendMessage(tabId, { action: 'controlAutomation', command: command }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`Error sending ${command} command:`, chrome.runtime.lastError.message);
           // Stop the process if content script is unreachable
           chrome.storage.local.set({ isRunning: false });
           sendStatusUpdate(false);
        } else {
          console.log(`Sent ${command} command to content script. Response:`, response);
        }
      });
    } else {
      console.log("No active ImageFX tab found.");
      // Stop the process if no relevant tab is found
      chrome.storage.local.set({ isRunning: false });
      sendStatusUpdate(false);
    }
  });
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAutomation') {
    console.log('Background: Received startAutomation');
    chrome.storage.local.set({ isRunning: true }, () => {
      sendStatusUpdate(true);
      sendCommandToContentScript('start'); // Tell content script to start the process
      sendResponse({ status: 'started' });
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (message.action === 'stopAutomation') {
    console.log('Background: Received stopAutomation');
    chrome.storage.local.set({ isRunning: false }, () => {
      sendStatusUpdate(false);
      sendCommandToContentScript('stop'); // Tell content script to stop
      sendResponse({ status: 'stopped' });
    });
    return true; // Indicates that the response is sent asynchronously
  }
  // Handle other potential messages if needed
});

// No longer need the placeholder function for executeScript
// function handleCommandFromBackground(command) { ... }

console.log("Background service worker started.");
