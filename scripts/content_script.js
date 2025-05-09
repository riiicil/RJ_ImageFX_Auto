console.log("RJ ImageFX Auto Downloader: Content script loaded.");

// --- Placeholders for Selectors (NEEDS ACTUAL VALUES) ---
// Selector for the container holding the main action buttons (Create, Copy, Restart)
const CONTROL_BUTTON_CONTAINER_SELECTOR = 'div.sc-2519865f-1.jfrQtS'; // Based on user provided HTML for button parent
// Selector for the Create/Generating button *within* the container (will be filtered further in JS)
const CREATE_BUTTON_SELECTOR_IN_CONTAINER = 'button.sc-7d2e2cf5-1'; // Using a potentially unstable class, needs refinement in JS
const IMAGE_RESULTS_CONTAINER_SELECTOR = 'div.sc-c44bf9e2-8.fnhPLW'; // Confirmed from user HTML
const INDIVIDUAL_IMAGE_CONTAINER_SELECTOR = 'div.sc-c2a92327-0'; // Confirmed from user HTML (wraps one image and its buttons)
const DOWNLOAD_ICON_SELECTOR_DIRECT = 'i.google-symbols'; // Will check textContent === 'download'
const MORE_OPTIONS_ICON_SELECTOR = 'i.material-icons'; // Will check textContent === 'more_vert'
const DOWNLOAD_MENU_ITEM_SELECTOR = 'div[role="menuitem"]'; // Will check for download icon inside
const CREATE_BUTTON_DISABLED_ATTRIBUTE = 'disabled'; // Confirmed from user HTML

// --- State Variables ---
let isRunning = false;
let observer = null; // To watch for new images
let processedImageSources = new Set(); // To avoid re-downloading same images if UI updates weirdly

// --- Core Functions ---

function findCreateButton() {
  // Find the container first
  const container = document.querySelector(CONTROL_BUTTON_CONTAINER_SELECTOR);
  if (!container) {
      console.error("Could not find control button container:", CONTROL_BUTTON_CONTAINER_SELECTOR);
      return null;
  }
  // Find potential buttons within the container
  const buttons = container.querySelectorAll(CREATE_BUTTON_SELECTOR_IN_CONTAINER);
  // Filter to find the one with the correct text ("Buat" or "Membuat ...")
  for (const button of buttons) {
      const buttonTextDiv = button.querySelector('div.sc-2519865f-2'); // Find the div holding the text based on user HTML
      if (buttonTextDiv) {
          const text = buttonTextDiv.textContent.trim();
          if (text === 'Buat' || text === 'Membuat ...') {
              console.log("Found create/generating button:", button);
              return button;
          }
      }
  }
  console.warn("Could not find button with text 'Buat' or 'Membuat ...' inside container:", CONTROL_BUTTON_CONTAINER_SELECTOR);
  return null; // Button not found
}

function isCreateButtonEnabled(button) {
  // TODO: Check if the button is enabled (not disabled)
  // This might check for the absence of the 'disabled' attribute or a specific class
  if (!button) return false;
  return !button.hasAttribute(CREATE_BUTTON_DISABLED_ATTRIBUTE); // Check for absence of 'disabled'
}

// Finds the direct download button OR the 'More Options' button within a single image container
function findInteractionButton(individualImageContainer) {
    if (!individualImageContainer) return { type: null, element: null };

    const buttonContainer = individualImageContainer.querySelector('div.sc-90c7624a-0'); // Container for overlay buttons
    if (!buttonContainer) return { type: null, element: null };

    // Try to find direct download button first (landscape/square)
    const iconsDirect = buttonContainer.querySelectorAll(DOWNLOAD_ICON_SELECTOR_DIRECT);
    for (const icon of iconsDirect) {
        if (icon.textContent.trim() === 'download') {
            const button = icon.closest('button');
            if (button) {
                // console.log("Found direct download button");
                return { type: 'direct', element: button };
            }
        }
    }

    // If direct download not found, try to find 'More Options' button (portrait)
    const iconsMore = buttonContainer.querySelectorAll(MORE_OPTIONS_ICON_SELECTOR);
    for (const icon of iconsMore) {
        if (icon.textContent.trim() === 'more_vert') {
            const button = icon.closest('button');
            if (button) {
                // console.log("Found 'More Options' button");
                return { type: 'menu', element: button };
            }
        }
    }

    // console.log("Neither direct download nor 'More Options' button found");
    return { type: null, element: null }; // Neither found
}

// Finds the download menu item *after* the 'More Options' menu has been opened
function findDownloadMenuItem() {
    // Menu items are likely added to the body or a high-level container, not inside the image container
    const menuItems = document.querySelectorAll(DOWNLOAD_MENU_ITEM_SELECTOR);
    for (const item of menuItems) {
        const icon = item.querySelector(DOWNLOAD_ICON_SELECTOR_DIRECT); // Look for download icon inside menu item
        if (icon && icon.textContent.trim() === 'download') {
            // console.log("Found download menu item:", item);
            return item;
        }
    }
    // console.log("Download menu item not found");
    return null;
}

// Simulates a mouse event on an element
function simulateMouseEvent(element, eventType) {
    if (!element) return;
    const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true
    });
    element.dispatchEvent(event);
}


function clickElement(element) {
  if (element) {
    console.log("Clicking element:", element);
    element.click();
  } else {
    console.error("Attempted to click null element.");
  }
}

function downloadImages() {
    console.log("Attempting to find and download images...");
    // Search the entire document for individual image containers
    const imageContainers = document.querySelectorAll(INDIVIDUAL_IMAGE_CONTAINER_SELECTOR);
    console.log(`Found ${imageContainers.length} total individual image containers on the page.`);

    // Check if any containers were found
    if (imageContainers.length === 0) {
        console.warn("No individual image containers found on the page with selector:", INDIVIDUAL_IMAGE_CONTAINER_SELECTOR);
        // Decide if we should retry or stop. For now, let the observer try again if needed.
        return; // Exit the function if no containers found
    }


    let downloadedCount = 0;
    const downloadPromises = []; // To track async operations

    imageContainers.forEach((container, index) => {
        const imgElement = container.querySelector('img.sc-c2a92327-1');
        const imgSrc = imgElement ? imgElement.src : null;

        // Check if this image source has already been processed in this run
        if (!imgSrc || processedImageSources.has(imgSrc)) {
            // console.log(`Skipping already processed or invalid image container ${index + 1}`);
            return; // Skip this container
        }

        // Mark as processed immediately to prevent re-processing in case of delays/re-renders
        processedImageSources.add(imgSrc);
        console.log(`Processing new image container ${index + 1}`);

        // Create a promise for each download attempt
        const downloadPromise = new Promise((resolve) => {
            // 1. Simulate hover to reveal buttons
            // console.log(`Simulating mouseover on container ${index + 1}`);
            simulateMouseEvent(container, 'mouseover');
            simulateMouseEvent(container, 'mouseenter'); // Sometimes one works better than the other

            // 2. Wait a short moment for buttons/menus to potentially appear/react
            setTimeout(() => {
                // 3. Find the initial interaction button (Direct Download or More Options)
                const interaction = findInteractionButton(container);

                if (interaction.type === 'direct' && interaction.element) {
                    // --- Direct Download Case ---
                    console.log(`Clicking direct download button for image ${index + 1}`);
                    clickElement(interaction.element);
                    downloadedCount++;
                    resolve(); // Done with this image
                } else if (interaction.type === 'menu' && interaction.element) {
                    // --- Menu Download Case ---
                    console.log(`Clicking 'More Options' for image ${index + 1}`);
                    clickElement(interaction.element);

                    // Wait a bit longer for the menu to appear
                    setTimeout(() => {
                        const downloadMenuItem = findDownloadMenuItem();
                        if (downloadMenuItem) {
                            console.log(`Clicking download menu item for image ${index + 1}`);
                            clickElement(downloadMenuItem);
                            downloadedCount++;
                        } else {
                            console.warn(`Could not find download menu item for image ${index + 1} after clicking 'More Options'.`);
                        }
                        resolve(); // Resolve the promise *after* attempting to click the menu item
                    }, 250); // Delay for menu appearance

                } else {
                    // --- Button Not Found Case ---
                    console.warn(`Could not find any interaction button (Download or More Options) for image ${index + 1} after hover.`);
                    resolve(); // Resolve the promise if no interaction button found
                }

                // 4. Simulate mouseout (optional)
                // simulateMouseEvent(container, 'mouseout');
                // simulateMouseEvent(container, 'mouseleave');

                // !! Removed the extra resolve() here that was causing premature resolution !!
            }, 150); // Delay for hover effect and initial button finding
        });
        downloadPromises.push(downloadPromise);
    });

    // Wait for all download attempts for this batch to complete
    Promise.all(downloadPromises).then(() => {
        console.log(`Finished processing batch. Downloaded ${downloadedCount} new images.`);
        // After all attempts, if still running, trigger the next creation cycle
        if (isRunning && downloadedCount > 0) { // Only loop if we actually downloaded something new
            console.log("Downloads initiated, preparing for next cycle.");
            // Wait a bit before starting next cycle
            setTimeout(startGenerationCycle, 1500); // Increased delay slightly
        } else if (isRunning && downloadedCount === 0) {
             console.log("No new images downloaded in this cycle. Waiting before checking again or stopping?");
             // Decide what to do - maybe wait longer? For now, let's just wait and try again later if needed by the observer.
             // Or maybe stop if nothing new is detected after a while?
             // Let's rely on the observer triggering again if needed.
        }
    });
}


function startGenerationCycle() {
    if (!isRunning) return; // Stop if flag is false

    console.log("Starting new generation cycle...");
    const createButton = findCreateButton();

    if (createButton && isCreateButtonEnabled(createButton)) {
        console.log("Clicking 'Create' button.");
        clickElement(createButton);
        // Now, wait for the button to become disabled, then enabled again,
        // and for the MutationObserver to detect new images.
        monitorGenerationProgress();
    } else if (!createButton) {
        console.error("Cannot find 'Create' button. Stopping automation.");
        stopAutomation();
    } else {
        console.log("'Create' button is not enabled yet. Waiting...");
        // Optionally, set a timeout to check again, but MutationObserver approach is better
        // setTimeout(startGenerationCycle, 500); // Simple retry (less ideal)
    }
}

function monitorGenerationProgress() {
    if (!isRunning) return;
    console.log("Monitoring generation progress...");

    const createButton = findCreateButton();
    if (!createButton) {
        console.error("Lost 'Create' button during monitoring. Stopping.");
        stopAutomation();
        return;
    }

    // Option 1: Poll the button state (simple but less efficient)
    /*
    const checkInterval = setInterval(() => {
        if (!isRunning) {
            clearInterval(checkInterval);
            return;
        }
        if (isCreateButtonEnabled(createButton)) {
            console.log("'Create' button re-enabled. Assuming generation finished.");
            clearInterval(checkInterval);
            // Now rely on MutationObserver to trigger download
        } else {
            // console.log("Generation in progress (button disabled)...");
        }
    }, 500); // Check every 500ms
    */

    // Option 2: Use MutationObserver on the button itself (more complex)
    // Monitor attributes of the create button
    const buttonObserver = new MutationObserver((mutationsList, observer) => {
        if (!isRunning) {
            observer.disconnect();
            return;
        }
        for(const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === CREATE_BUTTON_DISABLED_ATTRIBUTE.toLowerCase()) { // Ensure lowercase if checking attribute name
                 const buttonNowEnabled = isCreateButtonEnabled(mutation.target);
                 console.log(`Create button attribute changed. Enabled: ${buttonNowEnabled}`);
                 if (buttonNowEnabled) {
                     console.log("'Create' button re-enabled (detected by observer). Generation likely finished.");
                     observer.disconnect(); // Stop observing the button itself
                     // Now rely on the *other* observer (for results container) to trigger downloads.
                     // We might not even need this button observer if the results observer is reliable.
                 }
            }
        }
    });

    // Start observing the button for attribute changes (Optional, can be removed if body observer is reliable)
    // buttonObserver.observe(createButton, { attributes: true });


    // --- Setup MutationObserver on document.body ---
    // Observe the entire body for additions, then filter for relevant nodes.
    // This is generally more robust against timing issues and container selector changes.
    if (observer) observer.disconnect(); // Disconnect previous observer if any

    observer = new MutationObserver((mutationsList, obs) => {
        if (!isRunning) {
            obs.disconnect();
            return;
        }

        let relevantNodesAdded = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    // Check if the added node itself is an individual image container
                    // or if it *contains* one or more individual image containers.
                    if (node.nodeType === 1) { // Check if it's an element
                         // Check if the node itself matches or if it contains a matching descendant
                        if (node.matches(INDIVIDUAL_IMAGE_CONTAINER_SELECTOR) || node.querySelector(INDIVIDUAL_IMAGE_CONTAINER_SELECTOR)) {
                            console.log("Detected addition of relevant node:", node);
                            relevantNodesAdded = true;
                            break; // Found relevant node in this mutation's addedNodes
                        }
                    }
                }
            }
            if (relevantNodesAdded) break; // Found relevant node in this mutation batch
        }

        if (relevantNodesAdded) {
            console.log("Relevant image container node(s) detected by body MutationObserver.");
            // Wait a brief moment for elements to fully render before attempting download
            // Disconnect observer temporarily to avoid triggering multiple times for one batch
            // obs.disconnect(); // Maybe not disconnect? Let it keep watching. Reconnecting might be tricky.
            // console.log("Temporarily disconnected observer."); // Log if disconnecting

            // Use a flag or debounce mechanism if needed to prevent rapid firing of downloadImages
            // For now, just use a timeout
            setTimeout(() => {
                downloadImages(); // Attempt to download the newly detected images
                // Reconnect observer? Only if disconnected above.
                // if (isRunning) {
                //      console.log("Reconnecting observer.");
                //      observer.observe(document.body, { childList: true, subtree: true });
                // }
            }, 1000); // Increased delay slightly more to ensure rendering
        }
    });

    console.log("Starting MutationObserver on document.body");
    observer.observe(document.body, { childList: true, subtree: true }); // Watch the whole body

} // End of monitorGenerationProgress


function startAutomation() {
    if (isRunning) {
        console.warn("Automation is already running.");
        return;
    }
    console.log("Starting automation loop...");
    isRunning = true;
    processedImageSources.clear(); // Clear history for new session
    startGenerationCycle(); // Start the first cycle
}

function stopAutomation() {
    if (!isRunning) {
        // console.log("Automation is not running.");
        return;
    }
    console.log("Stopping automation loop...");
    isRunning = false;
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("MutationObserver disconnected.");
    }
    // Clear any pending timeouts if necessary
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  if (message.action === 'controlAutomation') {
    if (message.command === 'start') {
      startAutomation();
      sendResponse({ status: 'Starting automation...' });
    } else if (message.command === 'stop') {
      stopAutomation();
      sendResponse({ status: 'Stopping automation...' });
    } else {
      sendResponse({ status: 'Unknown command' });
    }
  }
  // Return true to indicate asynchronous response if needed, though maybe not here
  // return true;
});

// Initial check in case the extension was loaded while automation was supposed to be running
chrome.storage.local.get(['isRunning'], (result) => {
    if (result.isRunning) {
        console.log("Content script loaded while automation was running. Restarting cycle.");
        // Potentially restart the process if needed, or just set the state
        // Be careful not to trigger unwanted actions on script reload.
        // For now, just log it. A full restart might be complex.
        // startAutomation(); // Maybe too aggressive?
        isRunning = true; // Sync state
    } else {
        isRunning = false;
    }
});
