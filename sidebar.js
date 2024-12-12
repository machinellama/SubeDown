// Advanced settings state
let advancedVisible = false;

// Event Listeners for Tabs
document.getElementById("images-tab").addEventListener("click", () => {
  showSection("images");
});

document.getElementById("videos-tab").addEventListener("click", () => {
  showSection("videos");
});

// Event Listeners for Buttons
document.getElementById("download-all").addEventListener("click", () => {
  downloadAllImages();
});

document.getElementById("refresh-images").addEventListener("click", () => {
  showSection("images");
});

document.getElementById("advanced-toggle").addEventListener("click", () => {
  toggleAdvancedSettings();
});

document.getElementById("clear-advanced").addEventListener("click", () => {
  // Clear all replace/with pairs
  const replaceContainer = document.getElementById("replace-container");
  replaceContainer.innerHTML = `
    <div class="replace-row">
      <div class="flex">
        <label for="replace-text-1">replace</label>
        <input
          type="text"
          id="replace-text-1"
          class="replace-text"
          placeholder="e.g. http://oldsite.com/"
        />
      </div>
      <div class="flex">
        <label for="with-text-1">with</label>
        <input
          type="text"
          id="with-text-1"
          class="with-text"
          placeholder="e.g. http://newsite.com/"
        />
      </div>
    </div>
  `;

  // Reset image type checkboxes to checked
  const checkboxes = document.querySelectorAll(
    '#advanced-settings .checkbox-group input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => (cb.checked = true));

  // Clear size filters
  document.getElementById("min-size").value = "";
  document.getElementById("max-size").value = "";

  // Clear URL filter
  document.getElementById("url-filter").value = "";

  // Clear File Name Override
  document.getElementById("filename-override").value = "";

  // Clear Folder Name Override
  document.getElementById("foldername-override").value = "";

  // Uncheck Remove Queries
  document.getElementById("remove-queries").checked = false;
});

// Event Listener for Adding Replace/With Pair
document.getElementById("add-replace").addEventListener("click", () => {
  addReplaceRow();
});

// Establish connection with background script
const port = chrome.runtime.connect({ name: "sidebar" });

// Listen for messages from the background script
port.onMessage.addListener((message) => {
  if (message.type === "network-request") {
    const req = message.data;

    // Only process video requests
    if (isVideoRequest(req)) {
      addOrUpdateVideo(req);
    }
  }
});

// Optional: Clear the list when the sidebar is opened/refreshed
window.onload = () => {
  // Initialize the videNetworkList object
  for (const key in videNetworkList) {
    delete videNetworkList[key];
  }

  // Clear the UI
  const networkListElement = document.getElementById("network-requests");
  if (networkListElement) {
    networkListElement.innerHTML = "";
  }
};

// Function to show sections
async function showSection(section) {
  if (section === "images") {
    document.getElementById("images-section").style.display = "block";
    document.getElementById("videos-section").style.display = "none";
    document.getElementById("images-tab").classList.add("active");
    document.getElementById("videos-tab").classList.remove("active");
    await fetchImages();
  } else if (section === "videos") {
    document.getElementById("images-section").style.display = "none";
    document.getElementById("videos-section").style.display = "block";
    document.getElementById("images-tab").classList.remove("active");
    document.getElementById("videos-tab").classList.add("active");
    // Future implementation for videos
  }
}

// Initialize by showing the images section
showSection("images");
