const videNetworkList = {};
const MAX_NETWORK_LENGTH = 100;
const VIDEO_TYPES = ["video", "media", "xmlhttprequest"];

// Utility function to determine if a request is a video
function isVideoRequest(request) {
  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    const multipartIndicators = ["chunk", "segment", "part", "stream", "seg-"];

    if (
      request.type === "xmlhttprequest" &&
      !multipartIndicators.some((indicator) =>
        request.url.toLowerCase().includes(indicator)
      )
    ) {
      return false;
    }

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
    ".ts",
  ];
  try {
    const url = new URL(request.url);
    return videoExtensions.some((ext) => {
      if (url.pathname.includes(ext)) {
        return true;
      }
      return false;
    });
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
  // 4. Check for multipart indicators and only include things before the found indicator if found.

  try {
    const url = new URL(request.url);
    // Remove query parameters and fragments
    let baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Check for multipart indicators
    const multipartIndicators = ["chunk", "segment", "part", "stream", "seg-"];
    for (const indicator of multipartIndicators) {
      const index = baseUrl.toLowerCase().indexOf(indicator);
      if (index !== -1) {
        baseUrl = baseUrl.substring(0, index);
        break;
      }
    }

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

  if (isVideoRequest(request)) {
    if (!videNetworkList[request.tabId]) {
      videNetworkList[request.tabId] = {};
    }

    // Update the video entry
    videNetworkList[request.tabId][videoKey] = {
      url: request.url,
      method: request.method,
      type: request.type,
      tabId: request.tabId,
      tabTitle: request.tabTitle || null,
      parentURLName: request.parentURLName || null,
      timeStamp: request.timeStamp,
      parts: [], // Array to hold multipart segments
      lastUpdated: Date.now(),
    };

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

    updateVideoUI();
  }
}

function updateVideoUI() {
  const videosSection = document.getElementById("videos-section");

  if (!videosSection) {
    return;
  }

  videosSection.innerHTML = "";
  const descriptionDiv = document.createElement("div");
  descriptionDiv.classList.add("video-section-description");
  descriptionDiv.textContent = "Refresh the page to see the latest videos.";
  videosSection.appendChild(descriptionDiv);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let currentTabId = tabs[0]?.id;
    const current = videNetworkList[currentTabId];

    if (!current) {
      return;
    }

    const currentKeys = Object.keys(current);

    for (const key of currentKeys) {
      const video = current[key];

      const videoDiv = document.createElement("div");
      videoDiv.classList.add("video-entry");

      const urlWithoutQuery = video.url.split("?")[0];
      const tabTitle = video.tabTitle;

      const titleDiv = document.createElement("div");
      titleDiv.classList.add("video-title");
      titleDiv.textContent = tabTitle;
      videoDiv.appendChild(titleDiv);

      const urlDiv = document.createElement("div");
      urlDiv.classList.add("video-url");
      urlDiv.textContent = urlWithoutQuery;
      videoDiv.appendChild(urlDiv);

      const downloadBtn = document.createElement("button");
      downloadBtn.classList.add("download-btn");
      downloadBtn.textContent = "Download";
      videoDiv.appendChild(downloadBtn);

      const loadingIndicator = document.createElement("div");
      loadingIndicator.classList.add("loading-indicator");
      loadingIndicator.textContent = "Downloading...";
      videoDiv.appendChild(loadingIndicator);

      downloadBtn.addEventListener("click", async () => {
        loadingIndicator.style.display = "block";
        await downloadVideo(video.url, tabTitle);
        loadingIndicator.style.display = "none";
      });

      videosSection.appendChild(videoDiv);
    }
  });
}

async function downloadVideo(url, tabTitle) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      "Failed to fetch video:",
      response.status,
      response.statusText
    );
    return;
  }

  const blob = await response.blob();
  let filename = tabTitle || url.split("/").pop().split("?")[0] || "video";

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("video/")) {
    const ext = contentType.split("/")[1];
    if (ext && !filename.endsWith(`.${ext}`)) {
      filename += `.${ext}`;
    }
  }

  const objectUrl = URL.createObjectURL(blob);

  (browser.downloads || chrome.downloads).download(
    {
      url: objectUrl,
      filename: cleanURL(filename, true),
      conflictAction: "uniquify",
    },
    (downloadId) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError.message);
      }
    }
  );
}

// every time the tab changes to a new tab, update the UI
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateVideoUI();
});
