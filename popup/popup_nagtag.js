document.addEventListener('DOMContentLoaded', () => {
  console.log('[RJ ImageFX Auto NagTag] DOMContentLoaded: Initializing overlay logic from popup_nagtag.js.');
  const RUNS_BEFORE_NAG = 4; // Show after 4 runs (as per user setting)
  
  // Function to show support overlay
  function showSupportOverlay() {
    console.log('[RJ ImageFX Auto NagTag] showSupportOverlay: Attempting to show overlay.');
    document.getElementById('supportOverlay').classList.add('show');
  }
  
  // Function to hide support overlay
  function hideSupportOverlay() {
    console.log('[RJ ImageFX Auto NagTag Popup] hideSupportOverlay: Hiding popup overlay.');
    document.getElementById('supportOverlay').classList.remove('show');
    
    // Reset automationRuns to 0 and supportOverlayShown to false after showing the overlay
    chrome.storage.local.set({ 'automationRuns': 0, 'supportOverlayShown': false }, () => {
      console.log('[RJ ImageFX Auto NagTag Popup] automationRuns has been reset to 0, and supportOverlayShown to false in storage.');
    });
  }
  
  // Check if we should show support overlay on load
  chrome.storage.local.get(['automationRuns', 'supportOverlayShown'], function(data) {
    const runCount = data.automationRuns || 0;
    const overlayShown = data.supportOverlayShown || false;
    console.log(`[RJ ImageFX Auto NagTag] Initial load check: automationRuns = ${runCount}, supportOverlayShown = ${overlayShown}, RUNS_BEFORE_NAG = ${RUNS_BEFORE_NAG}`);
    
    if (runCount >= RUNS_BEFORE_NAG && !overlayShown) {
      console.log('[RJ ImageFX Auto NagTag] Initial load: Conditions met. Scheduling overlay display.');
      setTimeout(showSupportOverlay, 500);
    } else {
      console.log('[RJ ImageFX Auto NagTag] Initial load: Conditions NOT met or overlay already shown.');
    }
  });
  
  // Event for Start button - to track when automation begins
  document.getElementById('startButton').addEventListener('click', function() {
    console.log('[RJ ImageFX Auto NagTag] Start button clicked. Setting automationActive to true.');
    chrome.storage.local.set({ 'automationActive': true });
  });
  
  // Event for Stop button - increment run count when automation completes
  document.getElementById('stopButton').addEventListener('click', function() {
    console.log('[RJ ImageFX Auto NagTag] Stop button clicked.');
    chrome.storage.local.get(['automationActive'], function(data) {
      console.log(`[RJ ImageFX Auto NagTag] Stop button: automationActive from storage = ${data.automationActive}`);
      if (data.automationActive) {
        chrome.storage.local.get(['automationRuns'], function(runData) {
          const currentRuns = runData.automationRuns || 0;
          const newRunCount = currentRuns + 1;
          console.log(`[RJ ImageFX Auto NagTag] Stop button: Incrementing automationRuns. From ${currentRuns} to ${newRunCount}`);
          
          chrome.storage.local.set({ 
            'automationRuns': newRunCount,
            'automationActive': false // Reset automation active flag
          }, function() {
            console.log(`[RJ ImageFX Auto NagTag] Stop button: automationRuns set to ${newRunCount}, automationActive set to false.`);
            // Check if this run has crossed the threshold
            if (newRunCount >= RUNS_BEFORE_NAG) {
              console.log(`[RJ ImageFX Auto NagTag] Stop button: newRunCount (${newRunCount}) >= RUNS_BEFORE_NAG (${RUNS_BEFORE_NAG}). Checking if overlay can be shown.`);
              chrome.storage.local.get(['supportOverlayShown'], function(overlayData) {
                console.log(`[RJ ImageFX Auto NagTag] Stop button: supportOverlayShown from storage = ${overlayData.supportOverlayShown}`);
                if (!overlayData.supportOverlayShown) {
                  console.log('[RJ ImageFX Auto NagTag] Stop button: Conditions met. Showing overlay NOW.');
                  showSupportOverlay();
                } else {
                  console.log('[RJ ImageFX Auto NagTag] Stop button: Overlay not shown because supportOverlayShown is true.');
                }
              });
            } else {
              console.log(`[RJ ImageFX Auto NagTag] Stop button: newRunCount (${newRunCount}) < RUNS_BEFORE_NAG (${RUNS_BEFORE_NAG}). Overlay not shown.`);
            }
          });
        });
      } else {
        console.log('[RJ ImageFX Auto NagTag] Stop button: Automation was not active. Run not counted.');
      }
    });
  });
  
  // Skip button event
  document.getElementById('skipSupportBtn').addEventListener('click', hideSupportOverlay);

  // For easier debugging, you can run this in the popup's console to reset the flags:
  // chrome.storage.local.remove(['automationRuns', 'supportOverlayShown', 'automationActive'], () => { console.log('NagTag debug: Storage reset.'); });
  console.log('[RJ ImageFX Auto NagTag] Overlay logic and event listeners attached from popup_nagtag.js.');
}); 