document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const statusMessageElement = document.getElementById('statusMessage');
  const mainControlsContainer = document.getElementById('mainControlsContainer'); // Kontainer kontrol utama

  // Pengaturan Elements
  const toggleFloatingControls = document.getElementById('toggleFloatingControls');
  const toggleRandomize = document.getElementById('toggleRandomize');
  const toggleUseCustomPrompts = document.getElementById('toggleUseCustomPrompts');
  const customPromptsSection = document.getElementById('customPromptsSection');

  // Elements untuk "Use Your Prompt"
  const promptListDropdown = document.getElementById('promptListDropdown');
  const browseButtonLabel = document.getElementById('browseButtonLabel'); // Label "Browse" yang berfungsi sbg tombol
  const customPromptFile = document.getElementById('customPromptFile'); // Input file asli (hidden)
  const filePromptStatus = document.getElementById('filePromptStatus'); // Untuk "No file chosen" / "nama.txt"
  const loadedPromptsCount = document.getElementById('loadedPromptsCount'); // Untuk "Loaded x prompts"

  // Tambahkan elemen lain yang mungkin perlu di-disable saat otomasi
  const anotherDropdown = document.getElementById('anotherDropdown');
  const anotherFilePathInput = document.getElementById('anotherFilePath');

  // Fungsi untuk update visibilitas custom prompts section
  function updateCustomPromptsVisibility(show) {
    if (customPromptsSection) {
      customPromptsSection.classList.toggle('hidden', !show);
    }
    if (show) {
      // Reset dropdown Aspect Ratio ke "Aspect Ratio..." setiap kali section ini ditampilkan
      if (promptListDropdown) {
        promptListDropdown.value = 'Aspect Ratio...'; 
        // Simpan juga ke storage jika perlu, atau biarkan user memilih manual
        // Untuk sekarang, kita biarkan user memilih setelah section muncul.
        // Atau, jika ingin set default saat toggle aktif:
        // chrome.storage.local.set({ customPromptAspectRatio: 'Aspect Ratio...' });
      }
    } else {
      // Jika section disembunyikan (toggle Use Your Prompt dimatikan)
      // Reset file input dan statusnya
      if (customPromptFile) customPromptFile.value = ''; // Kosongkan pilihan file di input asli
      if (filePromptStatus) filePromptStatus.textContent = 'No file chosen';
      if (loadedPromptsCount) loadedPromptsCount.textContent = '';
      // Hapus juga dari storage jika perlu, agar saat diaktifkan lagi benar-benar fresh
      chrome.storage.local.remove(['customPromptList', 'customPromptFileName', 'currentCustomPromptIndex']);
    }
  }

  // Fungsi untuk update visibilitas kontrol utama di POPUP
  function updateMainControlsVisibilityInPopup(show) {
    if (mainControlsContainer) {
      mainControlsContainer.classList.toggle('hidden', !show);
    }
  }

  // Fungsi untuk mengupdate state tombol utama dan status
  function updateButtonStatesAndStatus(data) {
    if (!startButton || !stopButton || !statusMessageElement) return;

    const { isAutomating, cycleInProgress, imageFxPageReady } = data;
    const automationRunning = isAutomating || cycleInProgress; // True jika salah satu atau keduanya true

    // Menggunakan kelas status baru
    if (typeof imageFxPageReady === 'undefined' || !imageFxPageReady) {
      statusMessageElement.textContent = "Waiting for ImageFX to be ready...";
      statusMessageElement.className = "status-error";
      startButton.disabled = true;
      stopButton.disabled = true;
    } else if (isAutomating && cycleInProgress) {
      statusMessageElement.textContent = "Automation in progress...";
      statusMessageElement.className = "status-active";
      statusMessageElement.style.animation = "pulse 1.5s infinite";
      startButton.disabled = true;
      stopButton.disabled = false;
    } else if (isAutomating && !cycleInProgress) {
      statusMessageElement.textContent = "Automation active, waiting for next cycle..."; 
      statusMessageElement.className = "status-active";
      statusMessageElement.style.animation = "pulse 1.5s infinite";
      startButton.disabled = true;
      stopButton.disabled = false; 
    } else if (!isAutomating && cycleInProgress) {
      statusMessageElement.textContent = "Finishing last cycle before stopping...";
      statusMessageElement.className = "status-error";
      statusMessageElement.style.animation = "pulse 1.5s infinite";
      startButton.disabled = true;
      stopButton.disabled = true; 
    } else { // !isAutomating && !cycleInProgress && imageFxPageReady (implicit)
      statusMessageElement.textContent = "Ready to start";
      statusMessageElement.className = "";
      statusMessageElement.style.animation = "none";
      startButton.disabled = false;
      stopButton.disabled = true;
    }
    
    // Gunakan transisi dengan CSS daripada opacity langsung
    startButton.disabled = startButton.disabled;
    stopButton.disabled = stopButton.disabled;

    // Disable/Enable other settings based on automationRunning state
    // toggleFloatingControls tetap bisa diubah
    if (toggleRandomize) toggleRandomize.disabled = automationRunning;
    if (toggleUseCustomPrompts) toggleUseCustomPrompts.disabled = automationRunning;
    if (promptListDropdown) promptListDropdown.disabled = automationRunning;
    if (customPromptFile) customPromptFile.disabled = automationRunning;
    // Untuk browseButtonLabel, kita bisa disable dengan pointer-events atau class
    if (browseButtonLabel) {
        browseButtonLabel.style.pointerEvents = automationRunning ? 'none' : 'auto';
        browseButtonLabel.style.opacity = automationRunning ? 0.65 : 1; // Bootstrap disabled look
    }
    // Disable additional controls too
    if (anotherDropdown) anotherDropdown.disabled = automationRunning;
    if (anotherFilePathInput) anotherFilePathInput.disabled = automationRunning;
  }

  // Fungsi untuk inisialisasi dan update settings controls
  function updateSettingsControls(settings) {
    if (toggleUseCustomPrompts) {
      const useCustom = settings.toggleUseCustomPrompts || false; 
      toggleUseCustomPrompts.checked = useCustom;
      updateCustomPromptsVisibility(useCustom);
      // Jika useCustom true dan tidak ada file yang termuat (dari storage), pastikan statusnya "No file chosen"
      if (useCustom && !settings.customPromptFileName && filePromptStatus) {
        filePromptStatus.textContent = 'No file chosen';
      }
    }
    if (toggleFloatingControls) {
      const showFloating = settings.toggleFloatingControls || false; 
      toggleFloatingControls.checked = showFloating;
      updateMainControlsVisibilityInPopup(!showFloating); 
    }
    if (toggleRandomize) {
      toggleRandomize.checked = settings.toggleRandomize || false; 
    }

    // Inisialisasi untuk "Use Your Prompt" section
    if (promptListDropdown) {
      // Jika customPromptAspectRatio adalah 'Select...' atau undefined, set ke 'Aspect Ratio...'
      // Ini untuk handle kasus saat pertama kali load atau jika value lama 'Select...'
      promptListDropdown.value = (settings.customPromptAspectRatio && settings.customPromptAspectRatio !== 'Select...') 
                                 ? settings.customPromptAspectRatio 
                                 : 'Aspect Ratio...';
    }
    
    // Update tampilan status file dan jumlah prompt
    if (settings.customPromptFileName && filePromptStatus) {
      filePromptStatus.textContent = settings.customPromptFileName;
    } else if (filePromptStatus && settings.toggleUseCustomPrompts) { // Hanya set 'No file chosen' jika toggle aktif tapi tidak ada file
        filePromptStatus.textContent = 'No file chosen';
    }

    if (settings.customPromptList && settings.customPromptList.length > 0 && loadedPromptsCount) {
      loadedPromptsCount.textContent = `Loaded ${settings.customPromptList.length} prompts`;
    } else if (loadedPromptsCount) {
      loadedPromptsCount.textContent = ''; // Kosongkan jika tidak ada prompt
    }
  }

  // Muat state awal dari storage
  chrome.storage.local.get([
    'isAutomating',
    'cycleInProgress',
    'imageFxPageReady',
    'toggleFloatingControls',
    'toggleRandomize',
    'toggleUseCustomPrompts',
    'customPromptAspectRatio',
    'customPromptFileName',
    'customPromptList'
  ], (data) => {
    updateButtonStatesAndStatus(data);
    updateSettingsControls(data); // Panggil fungsi untuk settings
  });

  // Listener untuk perubahan di storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      let relevantChanges = {};
      let settingsChanges = {};
      let mainControlChange = false;
      let settingsControlChange = false;

      for (let key in changes) {
        if (['isAutomating', 'cycleInProgress', 'imageFxPageReady'].includes(key)) {
          relevantChanges[key] = changes[key].newValue;
          mainControlChange = true;
        } else if ([
            'toggleFloatingControls',
            'toggleRandomize',
            'toggleUseCustomPrompts',
            'customPromptAspectRatio',
            'customPromptFileName',
            'customPromptList'
          ].includes(key)){
          settingsChanges[key] = changes[key].newValue;
          settingsControlChange = true;
        }
      }

      // Gabungkan dengan state yang ada jika tidak semua berubah
      if (mainControlChange || settingsControlChange) {
          chrome.storage.local.get([
            'isAutomating', 'cycleInProgress', 'imageFxPageReady',
            'toggleFloatingControls', 'toggleRandomize', 'toggleUseCustomPrompts',
            'customPromptAspectRatio', 'customPromptFileName', 'customPromptList'
          ], (currentData) => {
            if (mainControlChange) {
                updateButtonStatesAndStatus({...currentData, ...relevantChanges});
            }
            if (settingsControlChange) {
                const newSettingsData = { ...currentData, ...settingsChanges };
                updateSettingsControls(newSettingsData);
            }
        });
      }
    }
  });

  // Event listeners untuk tombol utama
  if (startButton) {
    startButton.addEventListener('click', () => {
      console.log("[RJ ImageFX Auto Popup] Start button clicked");
      chrome.runtime.sendMessage({ action: "start" });
    });
  }

  if (stopButton) {
    stopButton.addEventListener('click', () => {
      console.log("[RJ ImageFX Auto Popup] Stop button clicked");
      chrome.runtime.sendMessage({ action: "stop" });
    });
  }

  // Event listeners untuk toggles pengaturan
  if (toggleUseCustomPrompts) {
    toggleUseCustomPrompts.addEventListener('change', (event) => {
      if (toggleUseCustomPrompts.disabled) return;

      const isChecked = event.target.checked;
      chrome.storage.local.get(['isAutomating', 'cycleInProgress', 'toggleRandomize', 'toggleFloatingControls'], (state) => {
        if (state.isAutomating || state.cycleInProgress) {
          console.warn("[RJ ImageFX Auto Popup] Attempted to change 'Use Your Prompt' while automation is running. Reverting.");
          event.target.checked = !isChecked;
          return;
        }

        let changesToStore = { toggleUseCustomPrompts: isChecked };
        if (isChecked && state.toggleRandomize) {
          changesToStore.toggleRandomize = false;
          if(toggleRandomize) toggleRandomize.checked = false; // Update UI immediately
        }

        chrome.storage.local.set(changesToStore, () => {
          // Ambil semua setting lagi untuk update UI yang komprehensif
          chrome.storage.local.get([
            'toggleFloatingControls',
            'toggleRandomize',
            'toggleUseCustomPrompts',
            'customPromptAspectRatio',
            'customPromptFileName',
            'customPromptList'
          ], (fullSettings) => updateSettingsControls(fullSettings));
        });
      });
    });
  }

  if (toggleFloatingControls) {
    toggleFloatingControls.addEventListener('change', (event) => {
      // Tidak perlu cek automationRunning di sini karena toggle ini selalu aktif
      const isChecked = event.target.checked; 
      updateMainControlsVisibilityInPopup(!isChecked); 
      chrome.storage.local.set({ toggleFloatingControls: isChecked }); 
      if (isChecked) {
        chrome.runtime.sendMessage({ action: "showFloatingControls" });
      } else {
        chrome.runtime.sendMessage({ action: "hideFloatingControls" });
      }
    });
  }

  if (toggleRandomize) {
    toggleRandomize.addEventListener('change', (event) => {
      if (toggleRandomize.disabled) return; 
      
      const isChecked = event.target.checked;
      chrome.storage.local.get(['isAutomating', 'cycleInProgress', 'toggleUseCustomPrompts', 'toggleFloatingControls'], (state) => {
        if (state.isAutomating || state.cycleInProgress) {
          console.warn("[RJ ImageFX Auto Popup] Attempted to change 'Randomize' while automation is running. Reverting.");
          event.target.checked = !isChecked;
          return;
        }

        let changesToStore = { toggleRandomize: isChecked };
        if (isChecked && state.toggleUseCustomPrompts) {
          changesToStore.toggleUseCustomPrompts = false;
          if(toggleUseCustomPrompts) toggleUseCustomPrompts.checked = false; // Update UI immediately
        }

        chrome.storage.local.set(changesToStore, () => {
          // Ambil semua setting lagi untuk update UI yang komprehensif
          chrome.storage.local.get([
            'toggleFloatingControls',
            'toggleRandomize',
            'toggleUseCustomPrompts',
            'customPromptAspectRatio',
            'customPromptFileName',
            'customPromptList'
          ], (fullSettings) => updateSettingsControls(fullSettings));
        });
      });
    });
  }

  // Event listener untuk dropdown rasio aspek di "Use Your Prompt"
  if (promptListDropdown) {
    promptListDropdown.addEventListener('change', (event) => {
      const selectedValue = event.target.value;
      chrome.storage.local.set({ customPromptAspectRatio: selectedValue });
      console.log(`[RJ ImageFX Auto Popup] Custom aspect ratio set to: ${selectedValue}`);
    });
  }

  // Event listener untuk input file prompt
  if (customPromptFile) {
    // Event listener untuk label "Browse" yang mentrigger input file
    if (browseButtonLabel) {
        browseButtonLabel.addEventListener('click', (event) => {
            event.preventDefault();
            if (!customPromptFile.disabled) { 
                customPromptFile.click();
            }
        });
    }

    customPromptFile.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.name.endsWith('.txt')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target.result;
            const promptsArray = content.split(/\r\n|\n|\r/)
                                      .map(prompt => prompt.trim())
                                      .filter(prompt => prompt.length > 0);

            if (promptsArray.length > 0) {
              chrome.storage.local.set({
                customPromptList: promptsArray,
                customPromptFileName: file.name,
                currentCustomPromptIndex: 0 // Reset index saat file baru dimuat
              }, () => {
                console.log(`[RJ ImageFX Auto Popup] Loaded ${promptsArray.length} prompts from ${file.name}.`);
                if (filePromptStatus) filePromptStatus.textContent = file.name;
                if (loadedPromptsCount) loadedPromptsCount.textContent = `Loaded ${promptsArray.length} prompts`;
              });
            } else {
              console.warn(`[RJ ImageFX Auto Popup] No valid prompts found in ${file.name}.`);
              if (filePromptStatus) filePromptStatus.textContent = 'No valid prompts in file.';
              if (loadedPromptsCount) loadedPromptsCount.textContent = '';
              // Kosongkan file dari input jika tidak valid agar bisa pilih lagi
              customPromptFile.value = ''; 
            }
          };
          reader.onerror = (e) => {
            console.error("[RJ ImageFX Auto Popup] Error reading file:", e);
            if (filePromptStatus) filePromptStatus.textContent = 'Error reading file.';
            if (loadedPromptsCount) loadedPromptsCount.textContent = '';
            customPromptFile.value = ''; 
          };
          reader.readAsText(file);
        } else {
          console.warn("[RJ ImageFX Auto Popup] Invalid file type. Please select a .txt file.");
          alert('Invalid file type. Please select a .txt file.');
          if (filePromptStatus) filePromptStatus.textContent = 'Please select a .txt file.';
          if (loadedPromptsCount) loadedPromptsCount.textContent = '';
          customPromptFile.value = '';
        }
      } else {
        // Tidak ada file yang dipilih (misal, user cancel dialog file)
        // Jangan ubah apa-apa, biarkan status file sebelumnya
      }
    });
  }
}); 