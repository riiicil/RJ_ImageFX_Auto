const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');

// Function to update the status display
function updateStatus(isRunning) {
  statusDiv.textContent = isRunning ? 'Status: Running' : 'Status: Idle';
  startButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
}

// Get the initial state when the popup opens
chrome.storage.local.get(['isRunning'], (result) => {
  updateStatus(result.isRunning || false);
});

// Listen for state changes from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStatus') {
    updateStatus(message.isRunning);
  }
});

// Add event listener for the Start button
startButton.addEventListener('click', () => {
  // Send message to background script to start
  chrome.runtime.sendMessage({ action: 'startAutomation' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending start message:", chrome.runtime.lastError.message);
      statusDiv.textContent = "Error starting. Check console.";
    } else if (response && response.status === 'started') {
      updateStatus(true);
    } else {
        console.warn("Unexpected response or no response from background on start:", response);
        // Optionally update status to indicate potential issue
    }
  });
});

// Add event listener for the Stop button
stopButton.addEventListener('click', () => {
  // Send message to background script to stop
  chrome.runtime.sendMessage({ action: 'stopAutomation' }, (response) => {
     if (chrome.runtime.lastError) {
      console.error("Error sending stop message:", chrome.runtime.lastError.message);
      statusDiv.textContent = "Error stopping. Check console.";
    } else if (response && response.status === 'stopped') {
      updateStatus(false);
    } else {
        console.warn("Unexpected response or no response from background on stop:", response);
         // Optionally update status to indicate potential issue
    }
  });
});
