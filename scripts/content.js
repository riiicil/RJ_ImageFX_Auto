console.log("[RJ ImageFX Auto] Content script loaded.");

let isAutomating = false;
let localImageFxPageReady = false; // Lokal flag untuk mengontrol pengecekan berulang
let isRandomizeMode = false; // Flag untuk mode randomize prompt
let isUseCustomPromptsMode = false; // Flag untuk mode Use Your Prompt
let recentAspectRatioChoices = []; // UNTUK SEMI-RANDOM

// Data untuk Custom Prompts
let customPromptList = [];
let customPromptAspectRatio = 'Random'; // Default
let currentCustomPromptIndex = 0;

// --- Language and UI Labels ---
let currentLang = 'en'; // Default to English
const uiLabels = {
  en: {
    promptTextArea: "Prompt textarea", // Deskripsi, bukan selector langsung
    resetPromptButton: "reset prompt button", // Deskripsi
    aspectRatioCombobox: "aspect ratio",
    aspectRatioOption: "aspect ratio option", // Untuk log
    luckyButton: "i'm feeling lucky",
    luckyButtonIcon: "casino",
    generateButton: "generate",
    generateButtonIcon: "spark",
    generatingButtonState: "generating", // Awal dari status "Generating..."
    moreVertIcon: "more_vert",
    downloadIcon: "download",
    // Floating Controls & Status
    fcTitle: "RJ ImageFX Auto", // MODIFIED
    fcStartButton: "Start Automation",
    fcStopButton: "Stop Automation",
    fcStatusLoading: "Loading status...",
    fcStatusWaitingReady: "Waiting for ImageFX to be ready...",
    fcStatusInProgress: "Automation in progress...",
    fcStatusActiveWaitingNext: "Automation active, waiting for next cycle...",
    fcStatusFinishing: "Finishing last cycle...",
    fcStatusReady: "Ready for automation.",
    fcStatusErrorLoading: "Error loading status.",
    // Log Messages
    logPageReadyPrompt: "ImageFX page ready (prompt input div found and visible).",
    logPageReadyLuckyButton: "ImageFX page ready ('I'm feeling lucky' button found and visible).",
    logPageNotReady: "ImageFX page not detected as ready yet. Will re-check.",
    // Image download related (jika ada teks UI yang relevan)
    downloadMenuItem: "download", // Teks pada menu item download setelah klik more_vert
  },
  id: {
    promptTextArea: "Textarea prompt",
    resetPromptButton: "tombol reset prompt",
    aspectRatioCombobox: "rasio aspek",
    aspectRatioOption: "opsi rasio aspek",
    luckyButton: "saya lagi beruntung",
    luckyButtonIcon: "casino", // Ikon biasanya sama
    generateButton: "buat",
    generateButtonIcon: "spark", // Ikon biasanya sama
    generatingButtonState: "membuat", // Awal dari status "Membuat..."
    moreVertIcon: "more_vert", // Ikon biasanya sama
    downloadIcon: "download", // Ikon biasanya sama
    // Floating Controls & Status
    fcTitle: "RJ ImageFX Auto", // MODIFIED
    fcStartButton: "Start Automation",
    fcStopButton: "Stop Automation",
    fcStatusLoading: "Memuat status...",
    fcStatusWaitingReady: "Menunggu ImageFX siap...",
    fcStatusInProgress: "Otomasi sedang berjalan...",
    fcStatusActiveWaitingNext: "Otomasi aktif, menunggu siklus berikutnya...",
    fcStatusFinishing: "Menyelesaikan siklus terakhir...",
    fcStatusReady: "Siap untuk otomasi.",
    fcStatusErrorLoading: "Error memuat status.",
    // Log Messages
    logPageReadyPrompt: "Halaman ImageFX siap (div input prompt ditemukan dan terlihat).",
    logPageReadyLuckyButton: "Halaman ImageFX siap (tombol 'Saya lagi beruntung' ditemukan dan terlihat).",
    logPageNotReady: "Halaman ImageFX belum terdeteksi siap. Akan dicek ulang.",
    // Image download related
    downloadMenuItem: "download", // Teks pada menu item download setelah klik more_vert (seringkali "Download" juga di UI ID)
  }
};

function detectLanguage() {
  const pathSegments = window.location.pathname.split('/');
  // Contoh: /fx/id/tools/image-fx -> id
  // Contoh: /fx/en/tools/image-fx -> en
  if (pathSegments.length > 2 && pathSegments[1] === 'fx') {
    const langCode = pathSegments[2].toLowerCase();
    if (uiLabels.hasOwnProperty(langCode)) {
      currentLang = langCode;
    } else {
      console.warn(`[RJ ImageFX Auto] Unsupported language code '${langCode}' in URL. Defaulting to 'en'.`);
      currentLang = 'en'; // Default jika bahasa dari URL tidak didukung
    }
  } else {
    console.log("[RJ ImageFX Auto] Language code not found in expected URL structure. Defaulting to 'en'.");
    currentLang = 'en'; // Default jika struktur URL tidak seperti yang diharapkan
  }
  console.log(`[RJ ImageFX Auto] Detected language: ${currentLang}`);
}
detectLanguage(); // Panggil sekali saat script dimuat

// --- Floating Controls Elements ---
let fcContainer = null;
let fcStartButton = null;
let fcStopButton = null;
let fcStatusMessage = null;
// let fcSummaryMessage = null; // <<< DIKOMENTARI: Element for summary message

// FC Nag Tag Elements
let fcSupportOverlayElement = null;
let fcSkipSupportButtonElement = null;
let fcGoSupportButtonElement = null;
const FC_RUNS_BEFORE_NAG = 4; // Show after 4 runs (mirip popup)
// --- End Floating Controls Elements ---

// --- DOM Element Helper Functions ---
function getPromptTextarea() {
  // Berdasarkan inspect: <div role="textbox" aria-multiline="true" class="sc-2725bd1-0 ..." ... contenteditable="true">
  return document.querySelector('div[role="textbox"][contenteditable="true"][data-slate-editor="true"]');
}

function getPromptText() {
  const textarea = getPromptTextarea();
  if (textarea) {
    // Coba cari teks dari elemen spesifik Slate.js
    const slateTextNodes = textarea.querySelectorAll('span[data-slate-string="true"], span[data-slate-leaf="true"][data-slate-string="true"]');
    let extractedText = "";
    if (slateTextNodes && slateTextNodes.length > 0) {
      slateTextNodes.forEach(node => {
        extractedText += node.textContent; // Metode paling sederhana untuk saat ini
        // Jika ada <br data-slate-void="true" /> sebagai sibling berikutnya, tambahkan newline
        if (node.nextSibling && node.nextSibling.nodeName === 'BR' && node.nextSibling.hasAttribute('data-slate-void')){
            if(!extractedText.endsWith('\n')) extractedText += '\n';
        }
      });
      return extractedText.replace(/\u200B/g, '').trim(); // Hapus ZWS dan trim
    }

    // Fallback: Jika tidak ada node Slate spesifik, gunakan innerText dan coba bersihkan placeholder
    console.warn("[RJ ImageFX Auto] getPromptText: Could not find specific Slate nodes. Falling back to innerText and attempting placeholder cleanup.");
    let fullInnerText = textarea.innerText;
    const placeholder = textarea.querySelector('div[data-slate-placeholder="true"]');
    if (placeholder && placeholder.offsetParent !== null && placeholder.innerText) { // Jika placeholder terlihat dan punya teks
        const placeholderText = placeholder.innerText.trim();
        // Hapus teks placeholder dari fullInnerText jika ada di awal. Ini bisa kurang akurat.
        if (fullInnerText.startsWith(placeholderText)) {
            fullInnerText = fullInnerText.substring(placeholderText.length);
        }
    }
    return fullInnerText.trim();
  }
  return "";
}

function findResetPromptButton() {
  // Tombol dengan ikon restart_alt: <i class="... material-icons-outlined ...\">restart_alt</i>
  // Pembungkusnya: <div class="sc-26d4ba0a-0 coTQxW sc-2519865f-0 cWIaav\">\r
  // Tidak ada teks label langsung, mengandalkan ikon 'restart_alt'
  const iconContainers = document.querySelectorAll('div[class^=\"sc-26d4ba0a-0\"] button i.material-icons-outlined');
  for (const icon of iconContainers) {
    if (icon.textContent.trim() === 'restart_alt') {
      const button = icon.closest('button');
      // Pastikan tombol terlihat (muncul saat ada teks)
      if (button && button.offsetParent !== null) return button;
    }
  }
  return null;
}

function findAspectRatioCombobox() {
  // Pembungkus luar untuk setiap combobox: <div class="sc-65325eee-8 iDEDEL" ...>
  // Di dalamnya ada button, dan di dalam button ada span class="sc-65325eee-11 chAPKY" yang berisi label
  const allComboboxWrappers = document.querySelectorAll('div[class^=\"sc-65325eee-8\"]');
  const targetLabel = uiLabels[currentLang].aspectRatioCombobox.toLowerCase();
  for (const wrapper of allComboboxWrappers) {
    const button = wrapper.querySelector('button[role=\"combobox\"][class^=\"sc-65325eee-9\"]');
    if (button) {
      const labelSpan = button.querySelector('span[class^=\"sc-65325eee-11\"]');
      if (labelSpan && labelSpan.textContent.trim().toLowerCase() === targetLabel) {
        if (button.offsetParent !== null) {
            return button;
        }
      }
    }
  }
  console.warn(`[RJ ImageFX Auto] Aspect ratio combobox (specifically labeled '${targetLabel}') not found.`);
  return null;
}

function findLuckyButton() {
  // <button class="sc-7d2e2cf5-1 hwJkVV sc-2519865f-4 kdkDdJ">
  // dengan ikon casino: <i class="... material-icons-outlined ...\">casino</i>
  // dan teks "I'm feeling lucky"
  const buttons = document.querySelectorAll('button[class^=\"sc-7d2e2cf5-1\"][class*=\"sc-2519865f-4\"]');
  const targetText = uiLabels[currentLang].luckyButton.toLowerCase();
  const targetIcon = uiLabels[currentLang].luckyButtonIcon.toLowerCase();

  for (const button of buttons) {
    const icon = button.querySelector('i.material-icons-outlined');
    const textDiv = button.querySelector('div[class^=\"sc-2519865f-2\"]');
    if (icon && icon.textContent.trim().toLowerCase() === targetIcon &&
        textDiv && textDiv.textContent.trim().toLowerCase() === targetText &&
        button.offsetParent !== null) {
      return button;
    }
  }
  return null;
}

async function clickElement(element, descriptionKey = "element") {
  const description = uiLabels[currentLang][descriptionKey] || descriptionKey; // Ambil deskripsi dari labels jika ada
  if (element && typeof element.click === 'function') {
    console.log(`[RJ ImageFX Auto] Clicking ${description}.`);
    element.click();
    await delay(300); // Sedikit delay setelah klik untuk UI update
    return true;
  }
  console.warn(`[RJ ImageFX Auto] Cannot click ${description}, element not found or not clickable.`);
  return false;
}

async function selectRandomAspectRatio() {
  console.log("[RJ ImageFX Auto] Attempting to select a random aspect ratio.");
  const aspectRatioCombobox = findAspectRatioCombobox();
  if (!aspectRatioCombobox) {
    console.error(`[RJ ImageFX Auto] ${uiLabels[currentLang].aspectRatioCombobox} not found.`);
    return false;
  }
  // Dapatkan ID listbox yang dikontrol oleh tombol combobox rasio aspek
  const controlledListboxId = aspectRatioCombobox.getAttribute('aria-controls');
  if (!controlledListboxId) {
    console.error(`[RJ ImageFX Auto] ${uiLabels[currentLang].aspectRatioCombobox} does not have aria-controls attribute.`);
    return false;
  }
  console.log(`[RJ ImageFX Auto] ${uiLabels[currentLang].aspectRatioCombobox} controls listbox ID: ${controlledListboxId}`);

  // 1. Klik tombol combobox untuk membuka dropdown
  const clickedCombobox = await clickElement(aspectRatioCombobox, "aspectRatioCombobox");
  if (!clickedCombobox) return false;

  await delay(700); // Beri waktu dropdown untuk muncul dan render (sesuaikan jika perlu)

  // 2. Cari kontainer dropdown yang terbuka
  let listboxContainer = null;
  const popperWrappers = document.querySelectorAll('div[data-radix-popper-content-wrapper]');
  for (const wrapper of popperWrappers) {
    const listbox = wrapper.querySelector(`div#${CSS.escape(controlledListboxId)}[role="listbox"][data-state="open"]`);
    if (listbox && listbox.offsetParent !== null) {
      listboxContainer = listbox;
      console.log("[RJ ImageFX Auto] Targeted aspect ratio listbox found using ID from aria-controls:", listboxContainer);
      break;
    }
  }

  if (!listboxContainer) {
    console.warn(`[RJ ImageFX Auto] Could not find listbox with ID ${controlledListboxId}. Attempting generic listbox search (less reliable).`);
    for (const wrapper of popperWrappers) {
        const genericListbox = wrapper.querySelector('div[role="listbox"][data-state="open"]');
        if (genericListbox && genericListbox.offsetParent !== null) {
            const firstOptionTextContent = genericListbox.querySelector('div[role="option"]')?.textContent || "";
            if (firstOptionTextContent.toLowerCase().includes("square") || firstOptionTextContent.toLowerCase().includes("landscape") || firstOptionTextContent.toLowerCase().includes("portrait")) {
                listboxContainer = genericListbox;
                console.log("[RJ ImageFX Auto] Found a generic listbox that seems to be for aspect ratio (fallback):", listboxContainer);
                break;
            }
        }
    }
  }

  if (!listboxContainer) {
    console.error("[RJ ImageFX Auto] Aspect ratio dropdown listbox not found or not open.");
    document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
    return false;
  }
  console.log("[RJ ImageFX Auto] Aspect ratio listbox found:", listboxContainer);

  // 3. Ambil semua item pilihan rasio aspek
  const aspectRatioOptionsNodeList = listboxContainer.querySelectorAll('div[role="option"][class^="sc-65325eee-6"]');
  if (aspectRatioOptionsNodeList.length === 0) {
    console.error("[RJ ImageFX Auto] No aspect ratio options found in the listbox.");
    document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
    return false;
  }
  const allAspectRatioOptions = Array.from(aspectRatioOptionsNodeList);
  console.log(`[RJ ImageFX Auto] Found ${allAspectRatioOptions.length} total aspect ratio options.`);

  // 4. Filter untuk semi-random selection
  let eligibleOptions = [];
  if (allAspectRatioOptions.length <= 2) { // Jika hanya <=2 opsi, tidak ada gunanya filtering canggih, bisa macet
    eligibleOptions = [...allAspectRatioOptions];
    if (recentAspectRatioChoices.length > 0 && allAspectRatioOptions.length > 1) {
        // Coba hindari yang paling terakhir jika memungkinkan
        eligibleOptions = allAspectRatioOptions.filter(opt => opt.textContent.trim() !== recentAspectRatioChoices[0]);
        if (eligibleOptions.length === 0) eligibleOptions = [...allAspectRatioOptions]; // Jika cuma 1 yg beda, ya sudah itu saja
    }
    console.log("[RJ ImageFX Auto] <=2 options available, using simplified filtering or all options:", eligibleOptions.map(o=>o.textContent.trim()));
  } else {
    for (const option of allAspectRatioOptions) {
        const optionText = option.textContent.trim();
        let isEligible = true;

        if (recentAspectRatioChoices.length > 0) {
            if (optionText === recentAspectRatioChoices[0]) { // Paling baru
                isEligible = false;
            } else if (recentAspectRatioChoices.length > 1 && optionText === recentAspectRatioChoices[1]) { // Kedua terbaru
                isEligible = false; // Karena baru 1 pilihan berbeda (H[0]) yang lewat
            } else if (recentAspectRatioChoices.length > 2 && optionText === recentAspectRatioChoices[2]) { // Ketiga terbaru
                // Boleh dipilih lagi JIKA dua pilihan sejak itu (H[0] dan H[1]) berbeda satu sama lain
                if (recentAspectRatioChoices[0] === recentAspectRatioChoices[1]) {
                    isEligible = false; // Dua pilihan terakhir sama, jadi belum ada 2 *berbeda* yang lewat
                }
            }
        }
        if (isEligible) {
            eligibleOptions.push(option);
        }
    }
  }
  
  let finalOptionsToChooseFrom;
  if (eligibleOptions.length > 0) {
      finalOptionsToChooseFrom = eligibleOptions;
      console.log(`[RJ ImageFX Auto] Semi-random: ${eligibleOptions.length} eligible options found:`, eligibleOptions.map(o => o.textContent.trim()));
      console.log("[RJ ImageFX Auto] Recent choices were:", recentAspectRatioChoices);
  } else {
      console.warn("[RJ ImageFX Auto] Semi-random: No strictly eligible options found after filtering. Falling back to all options. Recent choices:", recentAspectRatioChoices);
      finalOptionsToChooseFrom = allAspectRatioOptions; // Fallback ke semua opsi
  }


  // 5. Pilih satu secara acak dari daftar yang sudah difilter (atau fallback)
  const randomIndex = Math.floor(Math.random() * finalOptionsToChooseFrom.length);
  const randomOption = finalOptionsToChooseFrom[randomIndex];
  const selectedOptionText = randomOption.textContent.trim();
  console.log(`[RJ ImageFX Auto] Randomly selected aspect ratio option (from ${finalOptionsToChooseFrom.length} choices): "${selectedOptionText}"`);

  // 6. Klik item yang dipilih
  const clickedOption = await clickElement(randomOption, uiLabels[currentLang].aspectRatioOption + ` "${selectedOptionText}"`); // Ini bukan key, jadi langsung string
  if (!clickedOption) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
      return false;
  }
  
  await delay(500); // Beri waktu untuk dropdown tertutup dan nilai terupdate
  console.log("[RJ ImageFX Auto] Successfully selected aspect ratio: " + selectedOptionText);

  // 7. Update riwayat pilihan
  recentAspectRatioChoices.unshift(selectedOptionText); // Tambah ke depan
  if (recentAspectRatioChoices.length > 3) {
    recentAspectRatioChoices.length = 3; // Pangkas agar maksimal 3 entri
  }
  console.log("[RJ ImageFX Auto] Updated recent aspect ratio choices:", recentAspectRatioChoices);

  return true;
}

// --- End DOM Element Helper Functions ---

// Fungsi untuk menginject CSS kontrol melayang
function injectFloatingControlsCSS() {
  const cssFile = chrome.runtime.getURL('scripts/floating-controls.css');
  let link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', cssFile);
  document.head.appendChild(link);
  console.log("[RJ ImageFX Auto] Floating controls CSS injected.");
}

// Fungsi untuk membuat dan menampilkan kontrol melayang
function createFloatingControls() {
  // Check if fcContainer is already in the DOM to avoid re-creating if not necessary
  let existingFcContainer = document.getElementById('imagefx-auto-controls-container');

  if (fcContainer && existingFcContainer) {
    console.log("[RJ ImageFX Auto] createFloatingControls: FC elements already exist. Ensuring NagTag state only.");
    // Ensure NagTag overlay state is correct (this logic can remain)
    if (fcSupportOverlayElement) { 
        chrome.storage.local.get(['automationRuns', 'supportOverlayShown'], function(data) {
            const runCount = data.automationRuns || 0;
            const overlayShown = data.supportOverlayShown || false;
            if (fcSupportOverlayElement.classList.contains('show') && (runCount < FC_RUNS_BEFORE_NAG || overlayShown)) {
                 if (fcSupportOverlayElement) fcSupportOverlayElement.classList.remove('show');
            } else if (!fcSupportOverlayElement.classList.contains('show') && runCount >= FC_RUNS_BEFORE_NAG && !overlayShown){
                 showFcSupportOverlay(); 
            }
        });
    }
    return; // Already initialized and in DOM.
  }
  
  if (!fcContainer && existingFcContainer) {
      console.log("[RJ ImageFX Auto] Re-assigning global fcContainer vars from existing DOM element.");
      fcContainer = existingFcContainer;
      fcStartButton = document.getElementById('imagefx-auto-start-button');
      fcStopButton = document.getElementById('imagefx-auto-stop-button');
      fcStatusMessage = document.getElementById('imagefx-auto-status-message');
      // fcSupportOverlayElement might need re-linking too, or ensure it's created below.
  } 
 
  console.log("[RJ ImageFX Auto] Creating or re-creating floating control elements.");

  fcContainer = document.createElement('div');
  fcContainer.id = 'imagefx-auto-controls-container';
  fcContainer.style.display = 'none'; // Default to hidden when created

  const dragHandle = document.createElement('div');
  dragHandle.id = 'imagefx-auto-drag-handle';
  fcContainer.appendChild(dragHandle);

  // --- DRAG LOGIC START ---
  let isDragging = false;
  let offsetX, offsetY;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    // Calculate offset from the fcContainer's top-left corner, not the viewport
    offsetX = e.clientX - fcContainer.getBoundingClientRect().left;
    offsetY = e.clientY - fcContainer.getBoundingClientRect().top;
    fcContainer.style.cursor = 'grabbing'; // Optional: change cursor during drag
    // Prevent text selection during drag
    e.preventDefault(); 

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    // Calculate new position based on viewport coordinates
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;

    // Constrain to viewport (optional, but good practice)
    const containerWidth = fcContainer.offsetWidth;
    const containerHeight = fcContainer.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + containerWidth > viewportWidth) newX = viewportWidth - containerWidth;
    if (newY + containerHeight > viewportHeight) newY = viewportHeight - containerHeight;

    fcContainer.style.left = `${newX}px`;
    fcContainer.style.top = `${newY}px`;
    // fcContainer.style.right and fcContainer.style.bottom should be set to 'auto' or removed
    // if you are controlling position with top/left, to avoid conflicts.
    // Since we initialize with top/right from CSS, we need to adjust this.
    fcContainer.style.right = 'auto'; 
  }

  function onMouseUp() {
    isDragging = false;
    fcContainer.style.cursor = 'default'; // Optional: revert cursor
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  // --- DRAG LOGIC END ---

  const closeButton = document.createElement('div');
  closeButton.id = 'imagefx-auto-close-button';
  closeButton.innerHTML = '✕';
  closeButton.addEventListener('click', () => {
    // When closed, set the storage value to false. The onChanged listener will hide it.
    chrome.storage.local.set({ toggleFloatingControls: false });
  });
  fcContainer.appendChild(closeButton);

  const titleElement = document.createElement('h3'); 
  titleElement.textContent = uiLabels[currentLang].fcTitle;
  fcContainer.appendChild(titleElement);

  fcStartButton = document.createElement('button');
  fcStartButton.id = 'imagefx-auto-start-button'; 
  fcStartButton.textContent = uiLabels[currentLang].fcStartButton;
  fcStartButton.addEventListener('click', () => {
    if (!isAutomating && fcStartButton && !fcStartButton.disabled) { 
      console.log("[RJ ImageFX Auto] FC Start Button clicked. Requesting to start automation via storage.");
      chrome.storage.local.set({ isAutomating: true });
      chrome.storage.local.set({ 'automationActive': true }, () => {
         console.log('[RJ ImageFX Auto NagTag FC] automationActive set to true for NagTag counting.');
      });
    } else {
      console.log("[RJ ImageFX Auto] FC Start Button click ignored (isAutomating or button disabled). isAutomating:", 
                  isAutomating, "Disabled:", fcStartButton ? fcStartButton.disabled : 'unknown');
    }
  });
  fcContainer.appendChild(fcStartButton);
 
  fcStopButton = document.createElement('button');
  fcStopButton.id = 'imagefx-auto-stop-button'; 
  fcStopButton.textContent = uiLabels[currentLang].fcStopButton;
  fcStopButton.addEventListener('click', () => {
    if (isAutomating && fcStopButton && !fcStopButton.disabled) {
      console.log('[RJ ImageFX Auto NagTag FC] FC Stop Button réellement cliqué. Setting isAutomating to false in storage.');
      chrome.storage.local.set({ isAutomating: false }); 
      chrome.storage.local.get(['automationActive', 'automationRuns', 'supportOverlayShown'], function(data) {
        if (data.automationActive) { 
          const currentRuns = data.automationRuns || 0;
          const newRunCount = currentRuns + 1;
          console.log(`[RJ ImageFX Auto NagTag FC] Stop click: Incrementing runs from ${currentRuns} to ${newRunCount}.`);
          chrome.storage.local.set({
            automationRuns: newRunCount,
            automationActive: false 
          }, () => {
            console.log(`[RJ ImageFX Auto NagTag FC] Runs set to ${newRunCount}, automationActive is false.`);
            if (newRunCount >= FC_RUNS_BEFORE_NAG && !data.supportOverlayShown) {
              console.log('[RJ ImageFX Auto NagTag FC] Stop click: Conditions met to show NagTag overlay.');
              showFcSupportOverlay();
            }
          });
        } else {
          console.log('[RJ ImageFX Auto NagTag FC] Stop click: automationActive was false. Run not counted for NagTag via this stop.');
        }
      });
    } else {
       console.log("[RJ ImageFX Auto] FC Stop Button click ignored (not automating or button disabled). isAutomating:", isAutomating, "Disabled:", fcStopButton ? fcStopButton.disabled : 'unknown');
    }
  });
  fcContainer.appendChild(fcStopButton);

  fcStatusMessage = document.createElement('div');
  fcStatusMessage.id = 'imagefx-auto-status-message'; 
  fcStatusMessage.textContent = uiLabels[currentLang].fcStatusLoading;
  fcContainer.appendChild(fcStatusMessage);
  
  if (!existingFcContainer || !document.body.contains(existingFcContainer)) {
      if (existingFcContainer) existingFcContainer.remove(); 
      document.body.appendChild(fcContainer);
  }
  
  const existingFcSupportOverlay = document.querySelector('.fc-support-overlay');
  if (existingFcSupportOverlay && existingFcSupportOverlay.parentElement === fcContainer) {
      // If it already exists as a child of fcContainer, just ensure the variable is linked
      fcSupportOverlayElement = existingFcSupportOverlay;
      console.log("[RJ ImageFX Auto] FC NagTag Overlay re-linked from existing child.");
  } else {
      if (existingFcSupportOverlay) existingFcSupportOverlay.remove(); // Remove if it exists elsewhere
      fcSupportOverlayElement = document.createElement('div');
      fcSupportOverlayElement.className = 'fc-support-overlay'; 
      const modal = document.createElement('div');
      modal.className = 'fc-support-modal-simple';
      fcGoSupportButtonElement = document.createElement('a'); 
      fcGoSupportButtonElement.href = 'https://saweria.co/riiicil';
      fcGoSupportButtonElement.target = '_blank'; 
      fcGoSupportButtonElement.className = 'fc-support-btn fc-support-btn-primary';
      fcGoSupportButtonElement.textContent = 'Support Here'; 
      fcGoSupportButtonElement.addEventListener('click', () => { hideFcSupportOverlay(true); });
      fcSkipSupportButtonElement = document.createElement('button');
      fcSkipSupportButtonElement.className = 'fc-support-btn fc-support-btn-skip';
      fcSkipSupportButtonElement.textContent = 'Skip'; 
      fcSkipSupportButtonElement.addEventListener('click', () => hideFcSupportOverlay(false)); 
      modal.appendChild(fcGoSupportButtonElement);
      modal.appendChild(fcSkipSupportButtonElement);
      fcSupportOverlayElement.appendChild(modal);
      if (fcContainer) { 
        fcContainer.appendChild(fcSupportOverlayElement); 
        console.log("[RJ ImageFX Auto] FC NagTag Overlay created and appended to fcContainer.");
      } else {
        console.error("[RJ ImageFX Auto] fcContainer is null when trying to append NagTag Overlay. Overlay will not be visible.");
      }
  }

  // Initial check to show FC NagTag overlay if conditions already met (can remain here)
  chrome.storage.local.get(['automationRuns', 'supportOverlayShown'], function(data) {
    const runCount = data.automationRuns || 0;
    const overlayShown = data.supportOverlayShown || false;
    if (runCount >= FC_RUNS_BEFORE_NAG && !overlayShown) {
      console.log("[RJ ImageFX Auto] FC Initial NagTag check: Conditions met, showing overlay.");
      showFcSupportOverlay();
    } else {
      console.log(`[RJ ImageFX Auto] FC Initial NagTag check: Conditions NOT met or overlay already shown. Runs: ${runCount}, Shown: ${overlayShown}`);
    }
  });

  console.log("[RJ ImageFX Auto] Floating controls setup complete.");
  updateFloatingControlsUI(); 
}

// --- NagTag FC Helper Functions ---
function showFcSupportOverlay() {
  if (fcSupportOverlayElement) {
    console.log('[RJ ImageFX Auto NagTag FC] showFcSupportOverlay: Attempting to show FC overlay.');
    fcSupportOverlayElement.classList.add('show');
  } else {
    console.error('[RJ ImageFX Auto NagTag FC] fcSupportOverlayElement is null. Cannot show.');
  }
}

function hideFcSupportOverlay(isSupportButtonClicked = false) {
  if (fcSupportOverlayElement) {
    console.log(`[RJ ImageFX Auto NagTag FC] hideFcSupportOverlay: Hiding FC overlay. Support clicked: ${isSupportButtonClicked}`);
    fcSupportOverlayElement.classList.remove('show');

    // Reset automationRuns to 0 and supportOverlayShown to false after showing the overlay
    chrome.storage.local.set({ 'automationRuns': 0, 'supportOverlayShown': false }, () => {
      console.log('[RJ ImageFX Auto NagTag FC] automationRuns has been reset to 0, and supportOverlayShown to false in storage via FC overlay.');
    });
  } else {
    console.error('[RJ ImageFX Auto NagTag FC] fcSupportOverlayElement is null. Cannot hide.');
  }
}
// --- End NagTag FC Helper Functions ---

// Fungsi untuk mengupdate UI kontrol melayang
function updateFloatingControlsUI() {
  if (!fcContainer || !fcStartButton || !fcStopButton || !fcStatusMessage) {
    // Jika elemen belum siap (misal content script baru load & belum inject)
    // console.log("[RJ ImageFX Auto] Floating control elements not ready for UI update yet.");
    return;
  }

  chrome.storage.local.get(['isAutomating', 'cycleInProgress', 'imageFxPageReady'], (data) => {
    if (chrome.runtime.lastError) {
      console.error("[RJ ImageFX Auto] FC: Error getting status from storage:", chrome.runtime.lastError.message);
      fcStatusMessage.textContent = uiLabels.en.fcStatusErrorLoading;
      fcStatusMessage.className = "status-error";
      fcStatusMessage.style.animation = "none";
      fcStartButton.disabled = true;
      fcStopButton.disabled = true;
      return;
    }

    const { isAutomating: currentIsAutomating, cycleInProgress: currentCycleInProgress, imageFxPageReady: currentPageReady } = data;
    // console.log("[RJ ImageFX Auto] FC: Storage state for UI update:", data);

    if (typeof currentPageReady === 'undefined' || !currentPageReady) {
      fcStatusMessage.textContent = uiLabels.en.fcStatusWaitingReady;
      fcStatusMessage.className = "status-error";
      fcStatusMessage.style.animation = "none";
      fcStartButton.disabled = true;
      fcStopButton.disabled = true;
    } else if (currentIsAutomating && currentCycleInProgress) {
      fcStatusMessage.textContent = uiLabels.en.fcStatusInProgress;
      fcStatusMessage.className = "status-active";
      fcStatusMessage.style.animation = "pulse 1.5s infinite";
      fcStartButton.disabled = true;
      fcStopButton.disabled = false;
    } else if (currentIsAutomating && !currentCycleInProgress) {
      fcStatusMessage.textContent = uiLabels.en.fcStatusActiveWaitingNext;
      fcStatusMessage.className = "status-active";
      fcStatusMessage.style.animation = "pulse 1.5s infinite";
      fcStartButton.disabled = true;
      fcStopButton.disabled = false;
    } else if (!currentIsAutomating && currentCycleInProgress) {
      fcStatusMessage.textContent = uiLabels.en.fcStatusFinishing;
      fcStatusMessage.className = "status-error";
      fcStatusMessage.style.animation = "pulse 1.5s infinite";
      fcStartButton.disabled = true;
      fcStopButton.disabled = true;
    } else { // !currentIsAutomating && !currentCycleInProgress && currentPageReady
      fcStatusMessage.textContent = uiLabels.en.fcStatusReady;
      fcStatusMessage.className = "";
      fcStatusMessage.style.animation = "none";
      fcStartButton.disabled = false;
      fcStopButton.disabled = true;
    }
  });
}

// Fungsi untuk mengecek kesiapan halaman dan memberi sinyal
function checkPageReadyAndSignal() {
  if (localImageFxPageReady) return; 

  let pageIsReady = false;

  // 1. Cek div input prompt content-editable
  const promptEditableDiv = document.querySelector('div[role=\"textbox\"][contenteditable=\"true\"]');
  if (promptEditableDiv && promptEditableDiv.offsetParent !== null) {
    console.log(`[RJ ImageFX Auto] ${uiLabels[currentLang].logPageReadyPrompt}`);
    pageIsReady = true;
  }

  // 2. Jika belum terdeteksi, cek tombol "Saya lagi beruntung"
  if (!pageIsReady) {
    const buttons = document.querySelectorAll('button');
    const luckyButtonText = uiLabels[currentLang].luckyButton.toLowerCase();
    const luckyButtonIconText = uiLabels[currentLang].luckyButtonIcon.toLowerCase();

    for (const button of buttons) {
      const iconElement = button.querySelector('i.material-icons-outlined');
      const textDiv = button.querySelector('div');
      if (iconElement && iconElement.innerText.trim().toLowerCase() === luckyButtonIconText &&
          textDiv && textDiv.innerText.trim().toLowerCase() === luckyButtonText &&
          button.offsetParent !== null) {
        console.log(`[RJ ImageFX Auto] ${uiLabels[currentLang].logPageReadyLuckyButton}`);
        pageIsReady = true;
        break;
      }
    }
  }

  if (pageIsReady) {
    localImageFxPageReady = true;
    chrome.storage.local.set({ imageFxPageReady: true });
    if (checkReadyInterval) clearInterval(checkReadyInterval);
    
    createFloatingControls(); // Create FC elements if not already present (defaults to display:none)
    
    // Set initial visibility based on storage if page just became ready
    chrome.storage.local.get('toggleFloatingControls', (storageData) => {
        if (fcContainer) { 
            if (storageData.toggleFloatingControls === true) {
                fcContainer.style.display = 'flex';
                console.log("[RJ ImageFX Auto] FC visibility after page ready: Shown (toggle ON from storage).");
            } else {
                // fcContainer is already display:none by default from createFloatingControls
                console.log("[RJ ImageFX Auto] FC visibility after page ready: Hidden (toggle OFF or undefined from storage).");
            }
        }
    });
    updateFloatingControlsUI(); 
  } else {
    console.log(`[RJ ImageFX Auto] ${uiLabels[currentLang].logPageNotReady}`);
    chrome.storage.local.set({ imageFxPageReady: false });
  }
}

let checkReadyInterval = setInterval(checkPageReadyAndSignal, 2000); 
checkPageReadyAndSignal();

// Baca status awal dari storage saat content script dimuat
chrome.storage.local.get([
    "isAutomating", 
    "imageFxPageReady", 
    "toggleFloatingControls", 
    "toggleRandomize",
    "toggleUseCustomPrompts", 
    "customPromptList",       
    "customPromptAspectRatio",
    "currentCustomPromptIndex",
    "promptsProcessedThisSession",
    "imagesGeneratedThisSession",
    "cyclesCompletedThisSession"
], (data) => {
  if (chrome.runtime.lastError) {
    console.error("[RJ ImageFX Auto] Error reading initial states from storage:", chrome.runtime.lastError.message);
  } else {
    if (typeof data.isAutomating !== 'undefined') {
      isAutomating = data.isAutomating;
      console.log(`[RJ ImageFX Auto] Initial 'isAutomating' state from storage: ${isAutomating}`);
    }
    if (typeof data.imageFxPageReady !== 'undefined') {
        localImageFxPageReady = data.imageFxPageReady;
        console.log(`[RJ ImageFX Auto] Initial 'imageFxPageReady' state from storage: ${localImageFxPageReady}`);
        if (localImageFxPageReady) {
            createFloatingControls(); // Create FC elements if page is already ready
            // Set initial visibility based on storage
            if (fcContainer) { 
                if (data.toggleFloatingControls === true) {
                    fcContainer.style.display = 'flex';
                    console.log("[RJ ImageFX Auto] FC Initial visibility on load: Shown (toggle ON from storage).");
                } else {
                    // fcContainer is already display:none by default
                    console.log("[RJ ImageFX Auto] FC Initial visibility on load: Hidden (toggle OFF or undefined from storage).");
                }
            }
        }
    }
    if (typeof data.toggleRandomize !== 'undefined') { 
        isRandomizeMode = data.toggleRandomize;
        console.log(`[RJ ImageFX Auto] Initial 'isRandomizeMode' state from storage: ${isRandomizeMode}`);
    }
    // Muat state untuk "Use Custom Prompts"
    if (typeof data.toggleUseCustomPrompts !== 'undefined') {
        isUseCustomPromptsMode = data.toggleUseCustomPrompts;
        console.log(`[RJ ImageFX Auto] Initial 'isUseCustomPromptsMode' state from storage: ${isUseCustomPromptsMode}`);
    }
    if (data.customPromptList) {
        customPromptList = data.customPromptList;
        console.log(`[RJ ImageFX Auto] Initial custom prompt list loaded with ${customPromptList.length} prompts.`);
    }
    if (data.customPromptAspectRatio) {
        customPromptAspectRatio = data.customPromptAspectRatio;
        console.log(`[RJ ImageFX Auto] Initial custom aspect ratio: ${customPromptAspectRatio}`);
    }
    if (typeof data.currentCustomPromptIndex !== 'undefined') {
        currentCustomPromptIndex = data.currentCustomPromptIndex;
        console.log(`[RJ ImageFX Auto] Initial custom prompt index: ${currentCustomPromptIndex}`);
    }

    // Initialize local session stat variables (though they'll be reset on actual start)
    // These are just for console logging if needed before first run.
    console.log(`[RJ ImageFX Auto] Initial promptsProcessedThisSession: ${data.promptsProcessedThisSession || 0}`);
    console.log(`[RJ ImageFX Auto] Initial imagesGeneratedThisSession: ${data.imagesGeneratedThisSession || 0}`);
    console.log(`[RJ ImageFX Auto] Initial cyclesCompletedThisSession: ${data.cyclesCompletedThisSession || 0}`);

    if (isAutomating && localImageFxPageReady) {
      console.log("[RJ ImageFX Auto] Auto-starting due to storage state on load (page is ready).");
      chrome.storage.local.set({
        promptsProcessedThisSession: 0,
        imagesGeneratedThisSession: 0,
        cyclesCompletedThisSession: 0
      }, () => {
        if (fcStatusMessage) fcStatusMessage.textContent = '';
        startAutomation(); 
      });
    } else if (isAutomating && !localImageFxPageReady) {
      console.log("[RJ ImageFX Auto] isAutomating is true from storage, but page not ready yet. Will start once page is ready.");
    }
  }
});

// Listener untuk perubahan di storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    let needsUIUpdate = false;

    if (changes.toggleFloatingControls) {
        const shouldShow = changes.toggleFloatingControls.newValue;
        console.log(`[RJ ImageFX Auto] 'toggleFloatingControls' changed in storage to: ${shouldShow}`);
        createFloatingControls(); // Ensure FC elements exist
        if (fcContainer) {
            if (shouldShow === true) {
                fcContainer.style.display = 'flex';
                console.log("[RJ ImageFX Auto] FC shown due to storage change.");
            } else {
                fcContainer.style.display = 'none';
                console.log("[RJ ImageFX Auto] FC hidden due to storage change.");
            }
        } else {
            console.error("[RJ ImageFX Auto] fcContainer is null in storage.onChanged for toggleFloatingControls. Cannot set visibility.");
        }
        // No direct UI update call here for FC display, as it's handled above.
        // However, other parts of UI (like button states) might need an update if FC is shown/hidden.
        // For now, let's assume direct display change is enough.
    }

    if (changes.isAutomating) {
      const newAutomatingState = changes.isAutomating.newValue;
      const wasAutomating = changes.isAutomating.oldValue; 
      console.log(`[RJ ImageFX Auto] 'isAutomating' state updated from storage: ${newAutomatingState} (was: ${wasAutomating})`);
      isAutomating = newAutomatingState; 
      needsUIUpdate = true;

      if (isAutomating && !wasAutomating) { 
        console.log("[RJ ImageFX Auto] Automation just started by storage change.");
        chrome.storage.local.set({
          promptsProcessedThisSession: 0,
          imagesGeneratedThisSession: 0,
          cyclesCompletedThisSession: 0
        }, () => {
          if (localImageFxPageReady) {
            console.log("[RJ ImageFX Auto] Calling startAutomation() as page is ready.");
            startAutomation();
          } else {
            console.log("[RJ ImageFX Auto] Automation will start once page is ready.");
          }
        });
      } else if (!isAutomating && wasAutomating) { 
        console.log("[RJ ImageFX Auto] Automation stopped by storage change.");
        // Summary logic is still commented out
      } 
    }
    if (changes.imageFxPageReady) {
      const newPageReadyState = changes.imageFxPageReady.newValue;
      console.log(`[RJ ImageFX Auto] 'imageFxPageReady' state updated from storage: ${newPageReadyState}`);
      const oldPageReadyState = localImageFxPageReady;
      localImageFxPageReady = newPageReadyState;
      needsUIUpdate = true;

      if (localImageFxPageReady && !oldPageReadyState) {
        // createFloatingControls(); // Already called by checkPageReadyAndSignal or initial load
        // Initial visibility also handled there or by storage.onChanged for toggleFloatingControls
        if (isAutomating) {
           console.log("[RJ ImageFX Auto] Page just became ready, and isAutomating is true. Starting automation.");
           startAutomation();
        }
      }
    }
    if (changes.cycleInProgress) {
        console.log(`[RJ ImageFX Auto] 'cycleInProgress' state updated from storage: ${changes.cycleInProgress.newValue}`);
        needsUIUpdate = true;
    }
    if (changes.toggleRandomize) { 
        const newRandomizeState = changes.toggleRandomize.newValue;
        console.log(`[RJ ImageFX Auto] 'toggleRandomize' state updated from storage: ${newRandomizeState}`);
        isRandomizeMode = newRandomizeState;
    }
    if (changes.toggleUseCustomPrompts) {
        const newUseCustomState = changes.toggleUseCustomPrompts.newValue;
        console.log(`[RJ ImageFX Auto] 'isUseCustomPromptsMode' state updated from storage: ${newUseCustomState}`);
        isUseCustomPromptsMode = newUseCustomState;
    }
    if (changes.customPromptList) {
        customPromptList = changes.customPromptList.newValue || [];
        console.log(`[RJ ImageFX Auto] Custom prompt list updated from storage. New count: ${customPromptList.length}`);
    }
    if (changes.customPromptAspectRatio) {
        customPromptAspectRatio = changes.customPromptAspectRatio.newValue || 'Random';
        console.log(`[RJ ImageFX Auto] Custom aspect ratio updated from storage: ${customPromptAspectRatio}`);
    }
    if (changes.currentCustomPromptIndex) {
        currentCustomPromptIndex = changes.currentCustomPromptIndex.newValue || 0;
        console.log(`[RJ ImageFX Auto] Custom prompt index updated from storage: ${currentCustomPromptIndex}`);
    }

    if (needsUIUpdate) {
        updateFloatingControlsUI();
    }
  }
});

// Helper function to introduce a delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to find the "Buat" button
function findGenerateButton(silent = false) {
  const buttons = document.querySelectorAll('button:not([disabled])');
  const targetText = uiLabels[currentLang].generateButton.toLowerCase();
  const targetIcon = uiLabels[currentLang].generateButtonIcon.toLowerCase();

  for (const button of buttons) {
    const buttonTextDiv = button.querySelector('div');
    const iconElement = button.querySelector('i.google-symbols');
    if (buttonTextDiv && buttonTextDiv.innerText.trim().toLowerCase() === targetText) {
      if (iconElement && iconElement.innerText.trim().toLowerCase() === targetIcon) {
        return button;
      }
    }
  }
  if (!silent) {
      console.warn(`[RJ ImageFX Auto] findGenerateButton: '${targetText}' button not found.`);
  }
  return null;
}

// --- NEW: Simple appendToLog function ---
function appendToLog(message) {
  console.log(`[RJ ImageFX Auto LOG]: ${message}`);
}
// --- End appendToLog function ---

// Fungsi yang hilang - ditambahkan kembali
function isGenerateButtonDisabledAndProcessing() {
    const buttons = document.querySelectorAll('button[disabled]');
    const targetText = uiLabels[currentLang].generatingButtonState.toLowerCase();
    for (const button of buttons) {
        const buttonTextDiv = button.querySelector('div');
        // Mengecek apakah teks tombol DIMULAI dengan "generating..." atau "membuat..."
        if (buttonTextDiv && buttonTextDiv.innerText.trim().toLowerCase().startsWith(targetText)) {
            return true;
        }
    }
    return false;
}

// Function to check if the generate button is enabled (text "Buat" and spark icon)
function isGenerateButtonEnabled() {
  const button = findGenerateButton(); // findGenerateButton sudah mencari yang not disabled
  return !!button; // Jika ditemukan, berarti enabled dan sesuai kriteria
}

// NEW: Function to find all generated image cards and their actionable elements
async function findAllImageCards() { // <--- TAMBAHKAN ASYNC DI SINI
  console.log("[RJ ImageFX Auto] findAllImageCards: Starting investigation phase...");

  // Investigasi 1: Cari pembungkus luar dari inspect baru: div[class^="sc-d90fd836-2"]
  const outerWrappers = document.querySelectorAll('div[class^="sc-d90fd836-2"]');
  console.log(`[RJ ImageFX Auto] findAllImageCards: Found ${outerWrappers.length} potential outer wrappers (div[class^="sc-d90fd836-2"]).`);

  if (outerWrappers.length > 0) {
    outerWrappers.forEach((wrapper, i) => {
      console.log(`[RJ ImageFX Auto] Outer wrapper ${i + 1} outerHTML (first 500 chars):`, wrapper.outerHTML.substring(0, 500));
      // Coba cari target kita di dalam wrapper ini
      const potentialContentCardsInsideWrapper = wrapper.querySelectorAll('div[class^="sc-3891b690-0"]');
      console.log(`[RJ ImageFX Auto]   Inside outer wrapper ${i + 1}, found ${potentialContentCardsInsideWrapper.length} potential 'Kartu Konten' (div[class^="sc-3891b690-0"]).`);
      if (potentialContentCardsInsideWrapper.length > 0) {
          console.log(`[RJ ImageFX Auto]   First 'Kartu Konten' found in this wrapper:`, potentialContentCardsInsideWrapper[0].outerHTML.substring(0, 500));
      }
    });
  }

  console.log("[RJ ImageFX Auto] findAllImageCards: Starting search for new 'Kartu Konten' (div[class^='sc-3891b690-0']) globally as fallback.");
  // Berdasarkan inspect baru: <div class="sc-3891b690-0 kshWfx sc-fcc22c00-1 huzsvJ"> adalah "Kartu Konten"
  const potentialContentCards = document.querySelectorAll('div[class^="sc-3891b690-0"]');
  console.log(`[RJ ImageFX Auto] findAllImageCards: Found ${potentialContentCards.length} potential 'Kartu Konten' (globally).`);
  const validImageCards = [];

  // Mengubah forEach menjadi for...of agar bisa menggunakan await
  for (const contentCard of potentialContentCards) {
    const index = Array.from(potentialContentCards).indexOf(contentCard); // Dapatkan index jika perlu untuk logging
    console.log(`[RJ ImageFX Auto] --- Processing 'Kartu Konten' ${index + 1} of ${potentialContentCards.length} ---`, contentCard);

    // 1. Validate Image within its specific container ("kotak penampil gambar")
    // "Kotak penampil gambar": <div class="sc-4b84460-0 gCGrdy sc-3891b690-2 ksOXZ">
    // Ini adalah anak dari "Kartu Konten"
    const imageDisplayBox = contentCard.querySelector('div[class^="sc-4b84460-0"]');
    if (!imageDisplayBox) {
      console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: No 'kotak penampil gambar' (div[class^="sc-4b84460-0"]) found. Skipping.`);
      continue; // Lanjut ke Kartu Konten berikutnya
    }
    // Gambar: <img data-nimg="fill" class="sc-4b84460-1 fphGdf" ...>
    const imageElement = imageDisplayBox.querySelector('img[data-nimg="fill"][class^="sc-4b84460-1"]');
    if (!imageElement) {
      console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: No image (img[data-nimg="fill"][class^="sc-4b84460-1"]) found within 'kotak penampil gambar'. Skipping.`);
      continue; 
    }
    console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Found image element:`, imageElement);

    // --- MODIFIKASI DIMULAI DI SINI (MENGEMBALIKAN KE LOGIKA SEMULA) ---
    let isValid = false;

    // Logika lama dengan delay eksplisit di sini DIKEMBALIKAN:
    if (imageElement.src && imageElement.src.startsWith('data:image')) {
        if (imageElement.complete && imageElement.naturalWidth > 10 && imageElement.naturalHeight > 10 && imageElement.offsetParent !== null) {
            isValid = true;
        } else {
            // Jika belum complete, coba tunggu sebentar
            await delay(250); // << DIKEMBALIKAN
            if (imageElement.complete && imageElement.naturalWidth > 10 && imageElement.naturalHeight > 10 && imageElement.offsetParent !== null) {
                isValid = true;
                console.log(`[RJ ImageFX Auto] \'Kartu Konten\' ${index + 1}: Image became valid after a short delay.`);
            } else {
                 console.log(`[RJ ImageFX Auto] \'Kartu Konten\' ${index + 1}: Image still not valid after delay. Conditions: complete=${imageElement.complete}, naturalWidth=${imageElement.naturalWidth}, naturalHeight=${imageElement.naturalHeight}, offsetParent=${imageElement.offsetParent !== null}`);
            }
        }
    }

    // Logika baru (percobaan) DIKOMENTARI:
    // if (imageElement.src && imageElement.src.startsWith('data:image') &&
    //     imageElement.complete && // 'complete' tetap dicek di sini
    //     imageElement.naturalWidth > 10 &&
    //     imageElement.naturalHeight > 10 &&
    //     imageElement.offsetParent !== null) {
    //     isValid = true;
    // } else {
    //     // Log kondisi jika tidak valid, ini akan membantu jika ada masalah
    //     console.log(`[RJ ImageFX Auto] \'Kartu Konten\' ${index + 1}: Image check: src=${imageElement.src.startsWith('data:image')}, complete=${imageElement.complete}, w=${imageElement.naturalWidth}, h=${imageElement.naturalHeight}, visible=${imageElement.offsetParent !== null}.`);
    // }

    if (!isValid) {
    // --- MODIFIKASI BERAKHIR DI SINI ---
      console.log(`[RJ ImageFX Auto] \'Kartu Konten\' ${index + 1}: Image is not visible, too small, not loaded, or not a data URL (after check/delay). Src: ${imageElement.src ? imageElement.src.substring(0,100) : 'N/A'}. Skipping.`);
      continue; 
    }
    console.log(`[RJ ImageFX Auto] \'Kartu Konten\' ${index + 1}: Image is valid (visible, sized, loaded, data URL).`);

    let directDownloadButton = null;
    let moreVertButton = null;

    // 2. Find Direct Download Button (biasanya untuk landscape/square)
    // "Area Tombol": <div class="sc-26d4ba0a-0 coTQxW sc-6d79b58-5 bCddtT">
    // Ini adalah anak LANGSUNG dari "Kartu Konten", dan SIBLING dari "Area Gambar" (yang berisi imageDisplayBox)
    const actionButtonArea = contentCard.querySelector('div[class^="sc-26d4ba0a-0"]');
    if (actionButtonArea) {
      // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Found 'Area Tombol':`, actionButtonArea);
      const downloadButtonInActionArea = actionButtonArea.querySelector('button i.google-symbols');
      if (downloadButtonInActionArea && downloadButtonInActionArea.innerText.trim().toLowerCase() === uiLabels[currentLang].downloadIcon.toLowerCase()) {
        directDownloadButton = downloadButtonInActionArea.closest('button');
        // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Found direct download button in 'Area Tombol':`, directDownloadButton);
      }
    } else {
      // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: No 'Area Tombol' (div[class^="sc-26d4ba0a-0"]) found as direct child of 'Kartu Konten'.`);
    }

    // 3. Find More Vert Button (biasanya untuk portrait atau jika direct download tidak ada di 'Area Tombol' utama)
    // Tombol more_vert ada di dalam "kotak penampil gambar" -> "panel tombol potrait"
    // Panel tombol potrait: <div class="sc-4b84460-3 fvpqZJ"> (anak dari imageDisplayBox)
    // atau <div class="sc-4b84460-2 PQlq"> dari inspect lama jika struktur fallback ada.
    // Kita cari button dengan ikon more_vert di dalam imageDisplayBox jika directDownloadButton belum ketemu
    if (!directDownloadButton) {
        // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Direct download button not found in 'Area Tombol'. Checking for 'more_vert' inside 'kotak penampil gambar'.`);
        const portraitButtonPanel = imageDisplayBox.querySelector('div[class^="sc-4b84460-2"], div[class^="sc-4b84460-3"]'); // Menggunakan selector yang lebih fleksibel untuk panel
        if (portraitButtonPanel) {
            // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Found potential portrait button panel inside 'kotak penampil gambar':`, portraitButtonPanel);
            const moreVertIconElement = portraitButtonPanel.querySelector('button i.material-icons');
            if (moreVertIconElement && moreVertIconElement.innerText.trim().toLowerCase() === uiLabels[currentLang].moreVertIcon.toLowerCase()) {
                moreVertButton = moreVertIconElement.closest('button');
                // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Found more_vert button:`, moreVertButton);
            } else {
                //  console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: No 'more_vert' icon found in the portrait button panel.`);
            }
        } else {
            // console.log(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: No portrait button panel (div[class^="sc-4b84460-2"] or div[class^="sc-4b84460-3"]) found inside 'kotak penampil gambar'.`);
        }
    }
    
    if (!directDownloadButton && !moreVertButton) {
        console.warn(`[RJ ImageFX Auto] 'Kartu Konten' ${index + 1}: Valid image, but NEITHER direct download NOR more_vert button could be identified.`);
    }

    validImageCards.push({
      imageElement: imageElement,
      cardElement: contentCard, 
      directDownloadButton: directDownloadButton,
      moreVertButton: moreVertButton,
      imageDisplayBox: imageDisplayBox 
    });
    // console.log(`[RJ ImageFX Auto] --- 'Kartu Konten' ${index + 1} processed. Added to list. ---`);
  } // Akhir dari loop for...of

  console.log(`[RJ ImageFX Auto] findAllImageCards finished. Processed ${potentialContentCards.length} potential 'Kartu Konten', resulting in ${validImageCards.length} valid image card objects.`);
  return validImageCards;
}

// REPLACES inspectAndCountImages and previous findGeneratedImageCards
// The old inspectAndCountImages function is now removed.

async function waitForGenerationComplete(timeoutMs = 50000) {
  console.log("[RJ ImageFX Auto] Waiting for ImageFX processing to complete...");

  return new Promise(async (resolve) => {
    const startTime = Date.now();

    // ----- TAHAP 1: Menunggu tombol "Buat" kembali aktif atau "Membuat..." hilang ----- 
    console.log("[RJ ImageFX Auto] Stage 1: Waiting for generate button to be ready.");
    let stage1Completed = false;
    try {
      await new Promise((resolveStage1, rejectStage1) => {
        const checkButtonState = () => {
          const generateButtonReady = isGenerateButtonEnabled();
          const processingButtonGone = !isGenerateButtonDisabledAndProcessing();
          if (generateButtonReady || processingButtonGone) {
            console.log("[RJ ImageFX Auto] Stage 1: Generate button is ready or processing indication gone.");
            stage1Completed = true;
            resolveStage1();
            return true;
          }
          return false;
        };

        if (checkButtonState()) return;

        const buttonObserver = new MutationObserver(() => {
          if (checkButtonState()) {
            buttonObserver.disconnect();
          }
          if (Date.now() - startTime > timeoutMs) {
            buttonObserver.disconnect();
            rejectStage1(new Error("Timeout waiting for generate button to become ready (Stage 1)."));
          }
        });
        buttonObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class'] });
        
        const stage1TimeoutId = setTimeout(() => {
            buttonObserver.disconnect();
            rejectStage1(new Error("Fallback Timeout waiting for generate button (Stage 1)."));
        }, timeoutMs);

        const originalResolveStage1 = resolveStage1;
        resolveStage1 = (value) => {
            clearTimeout(stage1TimeoutId);
            originalResolveStage1(value);
        };
      });
    } catch (error) {
      console.error("[RJ ImageFX Auto] Stage 1 Error:", error.message);
      resolve([]); 
      return;
    }

    if (!stage1Completed) {
        console.log("[RJ ImageFX Auto] Stage 1 did not complete. Resolving with empty array.");
        resolve([]);
        return;
    }

    // ----- TAHAP 2: Menunggu kartu gambar yang sebenarnya muncul ----- 
    console.log("[RJ ImageFX Auto] Stage 2: Waiting for actual image cards to appear and be valid (approx 30s timeout for this stage - RESTORED)."); // RESTORED
    const stage2StartTime = Date.now();
    // const stage2TimeoutMs = 30000; // RESTORED to 30000
    const stage2TimeoutMs = 20000; // RESTORED to 30000

    try {
        await new Promise((resolveStage2, rejectStage2) => {
            const checkForValidCards = () => {
                const cards = findAllImageCards(); 
                if (cards.length > 0) {
                    const hasAtLeastOneValidSrc = cards.some(card => 
                        card.imageElement && 
                        card.imageElement.src && 
                        card.imageElement.src.startsWith('data:image') && 
                        card.imageElement.complete && 
                        card.imageElement.naturalWidth > 10
                    );
                    if (hasAtLeastOneValidSrc) {
                        console.log(`[RJ ImageFX Auto] Stage 2: Found ${cards.length} valid image cards with data URIs.`);
                        resolveStage2(cards); 
                        return true;
                    }
                    // console.log("[RJ ImageFX Auto] Stage 2: Cards found, but none have a valid data URI src yet or are incomplete. Still waiting...");
                }
                return false;
            };

            if (checkForValidCards()) return;

            const cardObserver = new MutationObserver(() => {
                if (checkForValidCards()) {
                    cardObserver.disconnect();
                }
                if (Date.now() - stage2StartTime > stage2TimeoutMs) {
                    cardObserver.disconnect();
                    console.warn("[RJ ImageFX Auto] Stage 2: Timeout waiting for valid image cards to appear.");
                    resolveStage2(findAllImageCards()); 
                }
            });

            cardObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class'] });

            const stage2TimeoutId = setTimeout(() => {
                cardObserver.disconnect();
                console.warn("[RJ ImageFX Auto] Stage 2: Fallback Timeout waiting for valid image cards.");
                resolveStage2(findAllImageCards()); 
            }, stage2TimeoutMs);
            
            const originalResolveStage2 = resolveStage2;
            resolveStage2 = (value) => {
                clearTimeout(stage2TimeoutId);
                originalResolveStage2(value);
            };
        }).then(resolve).catch(error => {
            console.error("[RJ ImageFX Auto] Stage 2 Error or explicit empty resolve:", error);
            resolve([]); 
        });
    } catch (error) {
        console.error("[RJ ImageFX Auto] Outer error in Stage 2 promise setup:", error);
        resolve([]);
    }
  });
}

// Function to find the main container of an image and its controls - NO LONGER USED by core logic
/*
function findImageCard(imageElement) {
  // ... (keep old implementation if desired, but mark as deprecated/unused)
  console.warn("[RJ ImageFX Auto] findImageCard is deprecated and no longer used by core logic.");
  return null;
}
*/

async function downloadGeneratedImages(imageCardObjects) {
  console.log(`[RJ ImageFX Auto] downloadGeneratedImages: Starting BATCH download for ${imageCardObjects.length} image(s).`);
  if (imageCardObjects.length === 0) {
    console.log("[RJ ImageFX Auto] downloadGeneratedImages: No images to download.");
    return 0;
  }

  let successfullyInitiatedCount = 0;
  const landscapeCards = [];
  const portraitCards = [];

  imageCardObjects.forEach(card => {
    if (card.directDownloadButton) {
      landscapeCards.push(card);
    } else if (card.moreVertButton) {
      portraitCards.push(card);
    } else {
      console.warn("[RJ ImageFX Auto] Card found without directDownload or moreVert button:", card);
    }
  });

  // --- Process Landscape Cards ---
  if (landscapeCards.length > 0) {
    console.log(`[RJ ImageFX Auto] Processing ${landscapeCards.length} landscape images.`);
    for (let i = 0; i < landscapeCards.length; i++) {
      const card = landscapeCards[i];
      console.log(`[RJ ImageFX Auto] Clicking direct download for landscape image ${i + 1}/${landscapeCards.length}`);
      try {
        card.directDownloadButton.click();
        successfullyInitiatedCount++;
        console.log(`[RJ ImageFX Auto] Direct download clicked for landscape ${i + 1}.`);
        if (i < landscapeCards.length - 1) {
          await delay(200); // Small delay between direct download clicks
        }
      } catch (e) {
        console.error(`[RJ ImageFX Auto] Error clicking direct download for landscape ${i + 1}:`, e, card.directDownloadButton);
      }
    }
     await delay(1500); // Wait for all direct downloads to start
  }

  // --- Process Portrait Cards ---
  if (portraitCards.length > 0) {
    console.log(`[RJ ImageFX Auto] Processing ${portraitCards.length} portrait images.`);
    
    // Step 1: Click all more_vert buttons to open their menus
    console.log("[RJ ImageFX Auto] Clicking all more_vert buttons for portrait images...");
    for (let i = 0; i < portraitCards.length; i++) {
      const card = portraitCards[i];
      if (card.moreVertButton) {
        try {
          console.log(`[RJ ImageFX Auto] Clicking more_vert for portrait image ${i + 1}/${portraitCards.length}`);
          card.moreVertButton.click(); // This should open the menu
          // We are not relying on aria-controls anymore for direct targeting, but clicking is essential.
          if (i < portraitCards.length - 1) {
             await delay(300); // Increased delay slightly between opening each menu to ensure it registers
          }
        } catch (e) {
          console.error(`[RJ ImageFX Auto] Error clicking more_vert for portrait ${i + 1}:`, e, card.moreVertButton);
        }
      }
    }

    // Step 2: Wait for all menus to hopefully open and stabilize
    if (portraitCards.length > 0) { // Only proceed if there were portrait cards to process
        console.log(`[RJ ImageFX Auto] Waiting 2 seconds for ${portraitCards.length} portrait menus to open and stabilize...`);
        await delay(2000); // Increased delay

        // Step 3: Find all visible popper menu wrappers and click download items
        console.log("[RJ ImageFX Auto] Finding and clicking download items in VISIBLE popper menus...");
        const allPopperWrappers = document.querySelectorAll('div[data-radix-popper-content-wrapper]');
        let portraitDownloadsAttempted = 0;

        for (const popperWrapper of allPopperWrappers) {
            if (portraitDownloadsAttempted >= portraitCards.length) {
                console.log("[RJ ImageFX Auto] All expected portrait downloads have been attempted. Stopping popper search.");
                break; // Optimization: if we've tried to download for all portrait cards, stop.
            }

            const style = getComputedStyle(popperWrapper);
            const rect = popperWrapper.getBoundingClientRect();
            const isMenuVisible = style.display !== 'none' &&
                                  style.visibility !== 'hidden' &&
                                  style.opacity !== '0' &&
                                  rect.width > 0 &&
                                  rect.height > 0 &&
                                  !popperWrapper.hasAttribute('data-fx-processed'); // Check if not processed

            if (isMenuVisible) {
              console.log("[RJ ImageFX Auto] Visible popper menu wrapper found. Searching for download item:", popperWrapper);
              let downloadMenuItem = null;
              // Search within the popper for the menu, then the item
              const menuElement = popperWrapper.querySelector('div[role="menu"]');
              if (menuElement) {
                const menuItems = menuElement.querySelectorAll('div[role="menuitem"]');
                for (const item of menuItems) {
                    const icon = item.querySelector('i.google-symbols');
                    const menuItemText = uiLabels[currentLang].downloadMenuItem.toLowerCase();
                    // Check icon innerText and also the menuitem's general innerText for robustness
                    if (icon && icon.innerText.trim().toLowerCase() === uiLabels[currentLang].downloadIcon.toLowerCase() && item.innerText.toLowerCase().includes(menuItemText)) {
                        downloadMenuItem = item;
                        break;
                    }
                }
              } else {
                console.warn("[RJ ImageFX Auto] No div[role='menu'] found inside visible popper wrapper:", popperWrapper);
              }

              if (downloadMenuItem) {
                console.log("[RJ ImageFX Auto] Attempting to click download menu item:", downloadMenuItem);
                try {
                    downloadMenuItem.click();
                    successfullyInitiatedCount++;
                    portraitDownloadsAttempted++;
                    console.log("[RJ ImageFX Auto] Download menu item clicked. Marking popper as processed.");
                    popperWrapper.setAttribute('data-fx-processed', 'true'); // Mark as processed
                    await delay(750); // Increased delay after click for download to initiate
                } catch (e) {
                     console.error("[RJ ImageFX Auto] Error clicking download menu item:", e);
                }
              } else {
                console.warn("[RJ ImageFX Auto] Download menu item not found in visible and unprocessed popper menu.");
              }
            } // end if isMenuVisible
        } // end for each popperWrapper

        // Attempt to close any lingering menus
        try {
            console.log("[RJ ImageFX Auto] Attempting to close any lingering menus with Escape key after processing poppers.");
            document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
            await delay(200); // small delay after escape
            // Second escape, just in case some menus are stubborn or layered
            document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true})); 
        } catch (e) {
            console.error("[RJ ImageFX Auto] Error sending Escape key to close menus:", e);
        }
    } // end if portraitCards.length > 0 (for menu processing part)
  } // end if portraitCards.length > 0 (for entire portrait section)
  
  console.log(`[RJ ImageFX Auto] downloadGeneratedImages (BATCH): Finished. Successfully initiated: ${successfullyInitiatedCount} out of ${imageCardObjects.length}.`);
  return successfullyInitiatedCount;
}

const MIN_IMAGES_EXPECTED_PER_CYCLE = 4; 
// let cycleInProgress = false; // Sudah dikelola via chrome.storage.local

async function runAutomationCycle() {
  // Pengecekan awal apakah otomasi masih aktif
  if (!isAutomating) {
    console.log("[RJ ImageFX Auto] runAutomationCycle: Automation is off. Halting.");
    // Pastikan cycleInProgress di storage false jika otomasi dihentikan mendadak
    // Namun, ini seharusnya sudah ditangani oleh stopAutomation() dan listener isAutomating
    // await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
    return;
  }

  // Cek kesiapan halaman
  if (!localImageFxPageReady) {
    console.warn("[RJ ImageFX Auto] runAutomationCycle: Page is not ready. Waiting for page ready signal.");
    return; 
  }
  
  // Memastikan tidak ada siklus lain yang berjalan dengan membaca dari storage
  let currentStorageState = await new Promise(resolve => chrome.storage.local.get('cycleInProgress', resolve));
  if (currentStorageState.cycleInProgress) {
      console.log("[RJ ImageFX Auto] runAutomationCycle: Another cycle detected as in progress from storage. Skipping this call.");
      return;
  }

  // Set cycleInProgress ke true di storage karena kita AKAN memulai siklus
  console.log("[RJ ImageFX Auto] runAutomationCycle: Starting new cycle. Setting cycleInProgress:true in storage.");
  await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: true }, resolve));

  let currentSessionStats = {};
  try {
    currentSessionStats = await new Promise(resolve => 
      chrome.storage.local.get([
        'promptsProcessedThisSession',
        'imagesGeneratedThisSession',
        'cyclesCompletedThisSession'
      ], resolve)
    );
    // Pastikan ada nilai default jika belum ada di storage
    currentSessionStats.promptsProcessedThisSession = currentSessionStats.promptsProcessedThisSession || 0;
    currentSessionStats.imagesGeneratedThisSession = currentSessionStats.imagesGeneratedThisSession || 0;
    currentSessionStats.cyclesCompletedThisSession = currentSessionStats.cyclesCompletedThisSession || 0;

    if (isUseCustomPromptsMode && !isRandomizeMode) { 
      console.log("[RJ ImageFX Auto] runAutomationCycle: Entering Use Your Prompt Mode.");
      if (!customPromptList || customPromptList.length === 0) {
        console.error("[RJ ImageFX Auto CustomPrompt] Prompt list is empty or not loaded. Aborting cycle.");
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log("[RJ ImageFX Auto CustomPrompt] Scheduling retry in 10s due to empty prompt list.");
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }

      if (currentCustomPromptIndex >= customPromptList.length || currentCustomPromptIndex < 0) {
        console.warn(`[RJ ImageFX Auto CustomPrompt] Invalid prompt index ${currentCustomPromptIndex}. Resetting to 0.`);
        currentCustomPromptIndex = 0;
        await new Promise(resolve => chrome.storage.local.set({ currentCustomPromptIndex: 0 }, resolve));
      }

      const currentPromptText = customPromptList[currentCustomPromptIndex];
      console.log(`[RJ ImageFX Auto CustomPrompt] Using prompt #${currentCustomPromptIndex + 1}: "${currentPromptText}"`);

      const promptSetSuccess = await setPromptText(currentPromptText);
      if (!promptSetSuccess) {
        console.error("[RJ ImageFX Auto CustomPrompt] Failed to set prompt text. Aborting cycle and scheduling retry.");
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log("[RJ ImageFX Auto CustomPrompt] Scheduling retry in 10s due to prompt set failure.");
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }
      
      // Increment promptsProcessedThisSession for custom mode
      currentSessionStats.promptsProcessedThisSession++;

      let aspectRatioSetSuccess = false;
      if (customPromptAspectRatio && customPromptAspectRatio.toLowerCase() !== 'select...') { // Pastikan bukan placeholder
        if (customPromptAspectRatio.toLowerCase() === 'random') {
          aspectRatioSetSuccess = await selectRandomAspectRatio();
        } else {
          aspectRatioSetSuccess = await selectSpecificAspectRatio(customPromptAspectRatio);
        }
      } else { // Jika 'Select...' atau tidak ada, anggap sukses (tidak memilih AR secara eksplisit)
          console.log("[RJ ImageFX Auto CustomPrompt] No specific aspect ratio selected or 'Select...' chosen. Skipping AR selection.");
          aspectRatioSetSuccess = true; 
      }


      if (!aspectRatioSetSuccess) {
        console.error("[RJ ImageFX Auto CustomPrompt] Failed to set aspect ratio. Aborting cycle and scheduling retry.");
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log("[RJ ImageFX Auto CustomPrompt] Scheduling retry in 10s due to aspect ratio set failure.");
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }
      await delay(500);

      // 3. Generate
      const generateButtonCustom = findGenerateButton();
      if (!generateButtonCustom) {
        console.error(`[RJ ImageFX Auto CustomPrompt] Could not find '${uiLabels[currentLang].generateButton}' button. Aborting and scheduling retry.`);
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log("[RJ ImageFX Auto CustomPrompt] Scheduling retry in 10s due to missing generate button.");
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }
      await clickElement(generateButtonCustom, "generateButton");
      await delay(1000);

      // 4. Wait for completion and download
      const imageCardObjects_custom = await waitForGenerationComplete();
      console.log(`[RJ ImageFX Auto CustomPrompt] Image generation finished. Found ${imageCardObjects_custom.length} image(s).`);
      if (imageCardObjects_custom.length > 0) {
        currentSessionStats.imagesGeneratedThisSession += imageCardObjects_custom.length;
        await downloadGeneratedImages(imageCardObjects_custom);
      }
      currentSessionStats.cyclesCompletedThisSession++;

      // 5. Update prompt index for next cycle OR STOP
      const nextPromptIndexCalc = currentCustomPromptIndex + 1;
      if (nextPromptIndexCalc >= customPromptList.length) {
        console.log("[RJ ImageFX Auto CustomPrompt] All prompts processed. Stopping automation.");
        await new Promise(resolve => 
          chrome.storage.local.set({
            isAutomating: false, 
            currentCustomPromptIndex: 0, // Reset index for next full run
            promptsProcessedThisSession: currentSessionStats.promptsProcessedThisSession,
            imagesGeneratedThisSession: currentSessionStats.imagesGeneratedThisSession,
            cyclesCompletedThisSession: currentSessionStats.cyclesCompletedThisSession
          }, resolve)
        );
        // isAutomating flag is now false, the storage listener will handle UI update for summary.
        // The finally block will handle cycleInProgress.
        // The main check at the end of runAutomationCycle won't schedule next if isAutomating is false.
        return; // Important to exit here
      } else {
        await new Promise(resolve => 
          chrome.storage.local.set({
            currentCustomPromptIndex: nextPromptIndexCalc,
            promptsProcessedThisSession: currentSessionStats.promptsProcessedThisSession,
            imagesGeneratedThisSession: currentSessionStats.imagesGeneratedThisSession,
            cyclesCompletedThisSession: currentSessionStats.cyclesCompletedThisSession
           }, resolve)
        );
        console.log(`[RJ ImageFX Auto CustomPrompt] Next prompt index will be: ${nextPromptIndexCalc}`);
      }

    } else if (isRandomizeMode) { 
      // --- ALUR RANDOMIZE ---
      console.log("[RJ ImageFX Auto] runAutomationCycle: Entering Randomize Mode.");

      // Langkah 2 (Hapus teks JIKA ADA)
      const promptTextArea = getPromptTextarea();
      if (promptTextArea && getPromptText().trim() !== "") {
        console.log("[RJ ImageFX Auto Randomize] Prompt text found. Attempting to clear it.");
        const resetSuccess = await clickElement(findResetPromptButton(), "resetPromptButton");
        if (resetSuccess) {
          await delay(600); // Tunggu teks hilang dan UI tombol lucky muncul
        } else {
          console.warn("[RJ ImageFX Auto Randomize] Failed to click reset prompt button, or button not found. Proceeding cautiously.");
        }
      } else {
        console.log("[RJ ImageFX Auto Randomize] Prompt is already empty or textarea not found. Proceeding.");
      }

      // Langkah 4 (Pilih Rasio Aspek Acak)
      const aspectRatioSelected = await selectRandomAspectRatio();
      if (!aspectRatioSelected) {
        console.error(`[RJ ImageFX Auto Randomize] Failed to select aspect ratio. Aborting randomize cycle and scheduling retry if automating.`);
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve)); 
        if (isAutomating) { 
            console.log(`[RJ ImageFX Auto Randomize] Scheduling retry for runAutomationCycle after 10s due to aspect ratio failure.`)
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }
      await delay(500); // Delay setelah aspek rasio dipilih

      // Langkah 5 (Klik Tombol "Saya lagi beruntung")
      const luckyButtonElement = findLuckyButton();
      if (!luckyButtonElement) {
        console.error(`[RJ ImageFX Auto Randomize] '${uiLabels[currentLang].luckyButton}' button not found. Aborting randomize cycle and scheduling retry if automating.`);
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log(`[RJ ImageFX Auto Randomize] Scheduling retry for runAutomationCycle after 10s due to missing '${uiLabels[currentLang].luckyButton}' button.`)
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }
      await clickElement(luckyButtonElement, "luckyButton");
      await delay(1000); // Tunggu UI generate mulai (tombol berubah jadi "Membuat...")

      // Langkah 6 (Generate & Download)
      const imageCardObjectsArray_rnd = await waitForGenerationComplete();
      console.log(`[RJ ImageFX Auto Randomize] Image card detection finished. Found ${imageCardObjectsArray_rnd.length} image card objects.`);

      if (imageCardObjectsArray_rnd.length > 0) {
        currentSessionStats.imagesGeneratedThisSession += imageCardObjectsArray_rnd.length;
        console.log(`[RJ ImageFX Auto Randomize] Proceeding to download from ${imageCardObjectsArray_rnd.length} image cards.`);
        const downloadedCount_rnd = await downloadGeneratedImages(imageCardObjectsArray_rnd); 
      }
      currentSessionStats.cyclesCompletedThisSession++;
      // Update stats in storage
      await new Promise(resolve => chrome.storage.local.set(currentSessionStats, resolve));
      
      console.log("[RJ ImageFX Auto Randomize] Attempting to clear prompt after lucky draw generation.");
      // Perlu dipastikan tombol reset muncul lagi setelah generate dari lucky button selesai
      // Tombol reset hanya muncul jika ada teks. Teks dari lucky draw seharusnya mengisi prompt.
      await delay(1000); // Beri waktu UI (prompt terisi) untuk update setelah generate selesai
      const promptTextAfterLucky = getPromptText();
      if (promptTextAfterLucky && promptTextAfterLucky.trim() !== "") {
        const resetAfterLuckySuccess = await clickElement(findResetPromptButton(), "resetPromptButton");
        if (resetAfterLuckySuccess) {
          await delay(600); 
          console.log("[RJ ImageFX Auto Randomize] Prompt cleared after lucky draw.");
        } else {
          console.warn("[RJ ImageFX Auto Randomize] Failed to click reset prompt button after lucky draw. Lucky button might not reappear correctly for next cycle.");
        }
      } else {
         console.log("[RJ ImageFX Auto Randomize] Prompt was empty or not found after lucky draw. Skipping reset.");
      }

    } else {
      // --- ALUR NORMAL --- (Jika tidak Custom Prompt dan tidak Randomize)
      console.log("[RJ ImageFX Auto] runAutomationCycle: Entering Normal Mode (No Custom Prompt, No Randomize).");
      const generateButtonElement = findGenerateButton();
      if (generateButtonElement) {
        console.log(`[RJ ImageFX Auto] Clicking '${uiLabels[currentLang].generateButton}' button.`);
        await clickElement(generateButtonElement, "generateButton");
        await delay(1000);
      } else {
        console.error(`[RJ ImageFX Auto] Could not find '${uiLabels[currentLang].generateButton}' button. Check page state. Will reset cycleInProgress and retry if automating.`);
        await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
        if (isAutomating) {
            console.log(`[RJ ImageFX Auto] Scheduling retry for runAutomationCycle after 10s due to missing '${uiLabels[currentLang].generateButton}' button.`)
            await delay(10000);
            if(isAutomating) runAutomationCycle();
        }
        return;
      }

      const imageCardObjectsArray_norm = await waitForGenerationComplete();
      console.log(`[RJ ImageFX Auto Normal] Image card detection finished. Found ${imageCardObjectsArray_norm.length} image card objects.`);

      if (imageCardObjectsArray_norm.length > 0) {
        currentSessionStats.imagesGeneratedThisSession += imageCardObjectsArray_norm.length;
        console.log(`[RJ ImageFX Auto Normal] Proceeding to download from ${imageCardObjectsArray_norm.length} image cards.`);
        const downloadedCount_norm = await downloadGeneratedImages(imageCardObjectsArray_norm); 
        if (downloadedCount_norm < imageCardObjectsArray_norm.length && downloadedCount_norm > 0) {
            console.warn(`[RJ ImageFX Auto Normal] Attempted to download ${imageCardObjectsArray_norm.length} cards, only ${downloadedCount_norm} initiated.`);
        } else if (downloadedCount_norm === imageCardObjectsArray_norm.length && downloadedCount_norm > 0) {
            console.log(`[RJ ImageFX Auto Normal] Successfully initiated download for all ${downloadedCount_norm} found image cards.`);
        } else if (downloadedCount_norm === 0 && imageCardObjectsArray_norm.length > 0) {
            console.warn(`[RJ ImageFX Auto Normal] Found ${imageCardObjectsArray_norm.length} cards, but failed to initiate download for any.`);
        }
      }
      currentSessionStats.cyclesCompletedThisSession++;
      // Update stats in storage
      await new Promise(resolve => chrome.storage.local.set(currentSessionStats, resolve));

    } // End if (isRandomizeMode)

  } catch (error) {
    console.error("[RJ ImageFX Auto] Error during automation cycle:", error);
    // Save any potentially updated stats even on error before this point
    await new Promise(resolve => chrome.storage.local.set(currentSessionStats, resolve));
  } finally {
    console.log("[RJ ImageFX Auto] runAutomationCycle: Cycle finished or errored. Setting cycleInProgress:false in storage.");
    await new Promise(resolve => chrome.storage.local.set({ cycleInProgress: false }, resolve));
  }

  // Logika untuk siklus berikutnya
  if (isAutomating) {
    console.log("[RJ ImageFX Auto] runAutomationCycle: Scheduling next cycle after 2s delay."); // MODIFIED Log
    await delay(2000); // MODIFIED from 5000 to 2000

    // Sebelum memanggil siklus berikutnya, pastikan storage.cycleInProgress sudah false
    let checkAttempts = 0;
    const maxCheckAttempts = 10; 
    while(checkAttempts < maxCheckAttempts) {
        currentStorageState = await new Promise(resolve => chrome.storage.local.get('cycleInProgress', resolve));
        if (!currentStorageState.cycleInProgress) {
            console.log("[RJ ImageFX Auto] runAutomationCycle: Confirmed cycleInProgress is false in storage. Proceeding to next cycle.");
            if (isAutomating) runAutomationCycle(); 
            return;
        }
        checkAttempts++;
        console.warn(`[RJ ImageFX Auto] runAutomationCycle: Waiting for cycleInProgress to be false in storage (Attempt ${checkAttempts}/${maxCheckAttempts}).`);
        await delay(100); 
    }
    console.error("[RJ ImageFX Auto] runAutomationCycle: cycleInProgress did not become false in storage after multiple attempts. Not starting next cycle to prevent overlap.");
  } else {
    console.log("[RJ ImageFX Auto] runAutomationCycle: Automation stopped. Not scheduling next cycle.");
  }
}

function startAutomation() {
  if (!localImageFxPageReady) {
    console.log("[RJ ImageFX Auto] startAutomation: Page not ready. Will start when page is ready if isAutomating is true.");
    return;
  }

  if (isAutomating) {
    console.log("[RJ ImageFX Auto] startAutomation: isAutomating true & page ready. Attempting to run cycle.");
    runAutomationCycle(); // runAutomationCycle akan cek cycleInProgress dari storage
  } else {
    console.log("[RJ ImageFX Auto] startAutomation: isAutomating is false. Not starting.");
  }
}

function stopAutomation(sendMessageToBg = true) {
  if (!isAutomating) {
    console.log("[RJ ImageFX Auto] Stop Automation called, but not currently automating.");
    updateFloatingControlsUI(); // Pastikan UI konsisten
    return;
  }
  console.log("[RJ ImageFX Auto] Stopping automation...");
  isAutomating = false;
  localImageFxPageReady = false; // Reset agar checkPageReadyAndSignal bisa bekerja lagi
  
  // currentAutomationPromise = null; // Hapus referensi promise yang berjalan
  
  // Kirim pesan ke background script untuk menghentikan proses di sana jika perlu
  if (sendMessageToBg) {
    chrome.runtime.sendMessage({ action: "stopAutomation" }, function (response) {
      if (chrome.runtime.lastError) {
        console.warn("[RJ ImageFX Auto] Error sending stop message to background:", chrome.runtime.lastError.message);
      } else {
        console.log("[RJ ImageFX Auto] Stop message sent to background, response:", response);
      }
    });
  }

  updateFloatingControlsUI(); // Update status di floating controls
  console.log("[RJ ImageFX Auto] Automation stopped.");

  // PENTING: Logika NagTag untuk stop button sudah dihandle di event listener fcStopButton
  // Tidak perlu duplikasi di sini, kecuali ada kasus khusus.
  // Jika stopAutomation bisa dipanggil dari tempat lain selain fcStopButton,
  // maka logika increment runCount dan check overlay perlu dipertimbangkan di sini juga.
  // Untuk saat ini, kita asumsikan stop dari UI FC adalah pemicu utama untuk NagTag di FC.
}

// Listener untuk pesan dari background.js atau popup.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("[RJ ImageFX Auto] Content script received message: ", request);
  
  if (request.command === "startAutomation") {
    chrome.storage.local.get("isAutomating", (data) => {
        if (data.isAutomating) {
            if (!isAutomating) { 
                 isAutomating = true; 
                 console.log("[RJ ImageFX Auto] Command 'startAutomation': local isAutomating updated to true.");
                 if(localImageFxPageReady) startAutomation();
            } else {
                 console.log("[RJ ImageFX Auto] Command 'startAutomation': isAutomating already true locally.");
                 if(localImageFxPageReady) startAutomation(); 
            }
            sendResponse({ status: "Automation start command received by content script." });
        } else {
            if(isAutomating) isAutomating = false;
            sendResponse({ status: "Automation not starting, storage indicates isAutomating is false." });
        }
    });
  } else if (request.command === "stopAutomation") {
    isAutomating = false; 
    console.log("[RJ ImageFX Auto] Command 'stopAutomation': set local isAutomating=false.");
    stopAutomation(); 
    sendResponse({ status: "Automation stop command received by content script." });
  }
  return true; // Untuk sendResponse asynchronous
}); 

// --- NEW: Function to set text in the prompt textarea ---
async function setPromptText(textToSet) {
    const textarea = getPromptTextarea(); // Ini adalah div contenteditable
    if (!textarea) {
        appendToLog("Error: Textarea for prompt not found in setPromptText.");
        return false;
    }

    appendToLog(`Attempting to set prompt via PASTE event: "${textToSet}"`);

    // 1. Focus the textarea
    textarea.focus();
    await delay(150); // Waktu lebih untuk fokus stabil dan editor siap

    // 2. Select all content in the contenteditable div
    // Ini penting agar 'paste' menggantikan konten, bukan menambahkan.
    const selection = window.getSelection();
    const range = document.createRange();
    try {
        // Jika textarea memiliki anak, pilih konten anak-anaknya.
        // Ini lebih aman untuk editor Slate yang mungkin memiliki struktur internal (misal, <p> kosong)
        if (textarea.firstChild) {
            range.selectNodeContents(textarea);
        } else {
            // Jika tidak ada anak (benar-benar kosong), set fokus saja sudah cukup
            // atau coba buat range di dalamnya jika perlu untuk beberapa browser.
            // Untuk sekarang, jika kosong, kita asumsikan fokus saja cukup sebelum paste.
            range.setStart(textarea, 0);
            range.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        appendToLog("Focused and selected content in textarea (if any).");
    } catch (e) {
        appendToLog(`Error during text selection: ${e.message}. Proceeding with paste attempt.`);
    }
    await delay(100); // Sedikit delay setelah seleksi

    // 3. Create a DataTransfer object and set data
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', textToSet);
    appendToLog("DataTransfer object created with plain text.");

    // 4. Dispatch the 'paste' event
    const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
    });
    textarea.dispatchEvent(pasteEvent);
    appendToLog("Dispatched 'paste' event.");
    await delay(250); // Beri editor waktu untuk memproses paste

    // 5. Dispatch 'input' event (sangat penting untuk React/Slate)
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    appendToLog("Dispatched 'input' event after paste.");
    await delay(100); // Waktu untuk state update

    // 6. Blur the textarea
    textarea.blur();
    appendToLog("Textarea blurred.");
    await delay(200); // Waktu untuk event blur diproses

    // 7. Verifikasi
    const currentText = getPromptText();
    if (currentText.trim() === textToSet.trim()) {
        appendToLog(`Verification PASSED. getPromptText is: "${currentText}"`);
    } else {
        appendToLog(`Verification FAILED. getPromptText is: "${currentText}", Expected: "${textToSet}"`);
        appendToLog(`Textarea innerHTML for debugging: ${textarea.innerHTML.substring(0, 500)}`);
    }

    const genButtonAfterInsert = findGenerateButton(true); // silent = true
    if (genButtonAfterInsert) {
        appendToLog("Generate button IS visible after inserting custom prompt.");
        return true; // Sukses jika tombol generate masih ada
    } else {
        appendToLog("Generate button DISAPPEARED after inserting custom prompt. Problem!");
        return false;
    }
}

function dispatchInputEvent(targetElement) {
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    targetElement.dispatchEvent(inputEvent);
    const changeEvent = new Event('change', { bubbles: true, cancelable: true }); // Also try 'change'
    targetElement.dispatchEvent(changeEvent);
}

// --- NEW: Function to select a specific aspect ratio ---
async function selectSpecificAspectRatio(aspectRatioString) {
  console.log(`[RJ ImageFX Auto] Attempting to select specific aspect ratio: ${aspectRatioString}`);
  if (aspectRatioString.toLowerCase() === 'random') {
      return await selectRandomAspectRatio();
  }

  const aspectRatioCombobox = findAspectRatioCombobox();
  if (!aspectRatioCombobox) {
    console.error(`[RJ ImageFX Auto] ${uiLabels[currentLang].aspectRatioCombobox} not found for specific selection.`);
    return false;
  }

  const controlledListboxId = aspectRatioCombobox.getAttribute('aria-controls');
  if (!controlledListboxId) {
    console.error(`[RJ ImageFX Auto] ${uiLabels[currentLang].aspectRatioCombobox} does not have aria-controls attribute for specific selection.`);
    return false;
  }

  // Gunakan key dari uiLabels jika memungkinkan, atau string biasa jika tidak.
  const clickedCombobox = await clickElement(aspectRatioCombobox, "aspectRatioCombobox"); 
  if (!clickedCombobox) return false;

  await delay(700); 

  let listboxContainer = null;
  const popperWrappers = document.querySelectorAll('div[data-radix-popper-content-wrapper]');
  for (const wrapper of popperWrappers) {
    const listbox = wrapper.querySelector(`div#${CSS.escape(controlledListboxId)}[role="listbox"][data-state="open"]`);
    if (listbox && listbox.offsetParent !== null) {
      listboxContainer = listbox;
      break;
    }
  }
   if (!listboxContainer) {
    console.warn(`[RJ ImageFX Auto] Could not find listbox with ID ${controlledListboxId} for specific AR. Attempting generic search.`);
     for (const wrapper of popperWrappers) {
        const genericListbox = wrapper.querySelector('div[role="listbox"][data-state="open"]');
        if (genericListbox && genericListbox.offsetParent !== null) {
            const firstOptionTextContent = genericListbox.querySelector('div[role="option"]')?.textContent || "";
            if (firstOptionTextContent.toLowerCase().includes("square") || firstOptionTextContent.toLowerCase().includes("landscape") || firstOptionTextContent.toLowerCase().includes("portrait")) {
                listboxContainer = genericListbox;
                console.log("[RJ ImageFX Auto] Found a generic listbox that seems to be for aspect ratio (fallback for specific AR):", listboxContainer);
                break;
            }
        }
    }
  }


  if (!listboxContainer) {
    console.error("[RJ ImageFX Auto] Aspect ratio dropdown listbox not found or not open for specific selection.");
    document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
    return false;
  }

  const aspectRatioOptions = listboxContainer.querySelectorAll('div[role="option"][class^="sc-65325eee-6"]');
  let foundOption = null;
  for (const option of aspectRatioOptions) {
    // Mencocokkan teks. Misalnya, "Lanskap (16:9)" harus cocok dengan "16:9"
    // Atau "Persegi (1:1)" dengan "1:1"
    // Kita akan mencari string yang diberikan di dalam textContent
    const optionText = option.textContent.trim();
    if (optionText.includes(aspectRatioString)) {
      foundOption = option;
      break;
    }
  }

  if (foundOption) {
    console.log(`[RJ ImageFX Auto] Found aspect ratio option: "${foundOption.textContent.trim()}" for "${aspectRatioString}"`);
    const clicked = await clickElement(foundOption, `aspect ratio option "${foundOption.textContent.trim()}"`);
    await delay(500); // Wait for dropdown to close and value to update
    
    // Update recent choices if successful, mimics selectRandomAspectRatio
    const selectedOptionText = foundOption.textContent.trim();
    recentAspectRatioChoices.unshift(selectedOptionText);
    if (recentAspectRatioChoices.length > 3) {
        recentAspectRatioChoices.length = 3;
    }
    console.log("[RJ ImageFX Auto] Updated recent aspect ratio choices (specific):", recentAspectRatioChoices);
    return clicked;
  } else {
    console.error(`[RJ ImageFX Auto] Aspect ratio option matching "${aspectRatioString}" not found.`);
    document.body.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'bubbles': true, 'cancelable': true}));
    return false;
  }
} 

// At the end of the script, ensure CSS is injected if not already handled by createFloatingControls logic
// This ensures it's available even if createFloatingControls isn't immediately called or is called multiple times.
if (!document.querySelector('link[href*="floating-controls.css"]')) {
  injectFloatingControlsCSS();
}