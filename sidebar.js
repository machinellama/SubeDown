let currentTabId;
let imagesData = [];
let downloadSuccess = [];
let downloadFailed = [];
const videNetworkList = {};
const MAX_NETWORK_LENGTH = 100;
const VIDEO_TYPES = ["video"];

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

// Utility function to determine if a request is a video
function isVideoRequest(request) {
  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    return true;
  }

  // Alternatively, check the file extension
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".ogg",
    ".mkv",
    ".flv",
    ".avi",
    ".mov",
  ];
  try {
    const url = new URL(request.url);
    return videoExtensions.some((ext) => url.pathname.endsWith(ext));
  } catch (e) {
    // If URL parsing fails, assume it's not a video
    return false;
  }
}

// Utility function to generate a unique key for each video
function generateVideoKey(request) {
  // Strategy:
  // 1. Use the base URL without query parameters and fragments.
  // 2. Include the tabId to differentiate videos from different tabs.
  // 3. Optionally, include a hash or timestamp if necessary.

  try {
    const url = new URL(request.url);
    // Remove query parameters and fragments
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    // Combine with tabId
    return `${request.tabId}:${baseUrl}`;
  } catch (e) {
    // Fallback in case of URL parsing error
    return `${request.tabId}:${request.url}`;
  }
}

// Function to add or update a video entry in videNetworkList
function addOrUpdateVideo(request) {
  const videoKey = generateVideoKey(request);

  if (videNetworkList[videoKey]) {
    // Video already exists, check if it's multipart
    const existingVideo = videNetworkList[videoKey];

    // Simple heuristic to detect multipart:
    // If the URL contains a segment like 'chunk', 'segment', or similar
    const multipartIndicators = ["chunk", "segment", "part", "stream"];
    const isMultipart = multipartIndicators.some((indicator) =>
      request.url.toLowerCase().includes(indicator)
    );

    if (isMultipart) {
      // Add the new part to the existing video entry
      existingVideo.parts.push({
        url: request.url,
        method: request.method,
        timeStamp: request.timeStamp,
      });

      // Optionally, update other metadata if needed
      existingVideo.lastUpdated = Date.now();
    }

    // If not multipart and already exists, do nothing to avoid duplicates
  } else {
    // New video entry
    const isMultipartInitial = false; // Assume initial request is not multipart

    videNetworkList[videoKey] = {
      url: request.url,
      method: request.method,
      type: request.type,
      tabId: request.tabId,
      timeStamp: request.timeStamp,
      parts: [], // Array to hold multipart segments
      lastUpdated: Date.now(),
    };
  }

  // Manage the size of videNetworkList
  if (Object.keys(videNetworkList).length > MAX_NETWORK_LENGTH) {
    // Remove the oldest entry
    const oldestKey = Object.keys(videNetworkList).reduce((a, b) => {
      return videNetworkList[a].timeStamp < videNetworkList[b].timeStamp
        ? a
        : b;
    });
    delete videNetworkList[oldestKey];
  }

  // Optionally, send the updated list to the UI
  updateUI();
}

// Function to update the UI with the latest videNetworkList
function updateUI() {
  // Implement UI update logic here
  // For example, clear and repopulate the list in the DOM
  const networkListElement = document.getElementById("network-requests");
  if (!networkListElement) return;

  // Clear existing list
  networkListElement.innerHTML = "";

  // Iterate over videNetworkList and display entries
  for (const [key, video] of Object.entries(videNetworkList)) {
    const listItem = document.createElement("li");
    listItem.className = "request-item";

    // Display basic video info
    let displayText = `[${new Date(video.timeStamp).toLocaleTimeString()}] ${
      video.method
    } ${video.url}`;

    // If multipart, indicate the number of parts
    if (video.parts.length > 0) {
      displayText += ` (${video.parts.length} parts)`;
    }

    listItem.textContent = displayText;
    networkListElement.appendChild(listItem);
  }
}

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
  } else if (message.type === "init") {
    console.log(message.message);
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
