const videoNetworkList = {};
const MAX_NETWORK_LENGTH = 100;
const VIDEO_TYPES = ["video", "media", "xmlhttprequest"];

const MULTIPART_INDICATORS = ["chunk-", "segment-", "part-", "stream-", "seg-"];

// Utility function to determine if a request is a video
function isVideoRequest(request) {
  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    if (
      request.type === "xmlhttprequest" &&
      !MULTIPART_INDICATORS.some((indicator) =>
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
  try {
    const url = new URL(request.url);
    // Remove query parameters and fragments
    let baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Check for multipart indicators
    for (const indicator of MULTIPART_INDICATORS) {
      const index = baseUrl.toLowerCase().indexOf(indicator);
      if (index !== -1) {
        // Truncate at the indicator to get a base URL for multi-part
        baseUrl = baseUrl.substring(0, index + indicator.length);
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

// Function to add or update a video entry in videoNetworkList
function addOrUpdateVideo(request) {
  const videoKey = generateVideoKey(request);

  if (isVideoRequest(request)) {
    if (!videoNetworkList[request.tabId]) {
      videoNetworkList[request.tabId] = {};
    }

    // Determine if this is a multi-part stream
    let isMultipart = false;
    let multipartBaseUrl = request.url;
    let multiReplace = "";
    try {
      const url = new URL(request.url);
      let pathname = url.pathname;
      for (const indicator of MULTIPART_INDICATORS) {
        const index = pathname.toLowerCase().indexOf(indicator);
        if (index !== -1) {
          // e.g. https://example.com/video/seg-1.ts
          // base would be everything up to seg-
          // In this case we keep indicator to easily append numbers:
          // base: https://example.com/video/seg-
          multipartBaseUrl = `${url.protocol}//${
            url.host
          }${url.pathname.substring(0, index + indicator.length)}`;
          isMultipart = true;
          multiReplace = indicator;
          break;
        }
      }
    } catch (e) {
      // If URL parsing fails, just leave isMultipart as false
    }

    // Update the video entry
    videoNetworkList[request.tabId][videoKey] = {
      url: request.url,
      method: request.method,
      type: request.type,
      tabId: request.tabId,
      tabTitle: request.tabTitle || null,
      parentURLName: request.parentURLName || null,
      timeStamp: request.timeStamp,
      parts: [], // Array to hold multipart segments if needed
      lastUpdated: Date.now(),
      isMultipart,
      multipartBaseUrl,
      multiReplace,
    };

    // Manage the size of videoNetworkList
    if (Object.keys(videoNetworkList).length > MAX_NETWORK_LENGTH) {
      // Remove the oldest entry
      const oldestKey = Object.keys(videoNetworkList).reduce((a, b) => {
        return videoNetworkList[a].timeStamp < videoNetworkList[b].timeStamp
          ? a
          : b;
      });
      delete videoNetworkList[oldestKey];
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
    const current = videoNetworkList[currentTabId];

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
        downloadBtn.style.display = "none";

        try {
          current.loadingIndicator = loadingIndicator;
          if (video.isMultipart) {
            // Attempt multi-part download
            await downloadFullMultipartVideo(video, tabTitle, current);
          } else {
            // Normal single video download
            await downloadVideo(video.url, tabTitle, current);
          }
        } catch (err) {
          showError("Download failed: ", err);
        } finally {
          loadingIndicator.style.display = "none";
          downloadBtn.style.display = "block";
        }
      });

      videosSection.appendChild(videoDiv);
    }
  });
}

async function downloadVideo(url, tabTitle, current) {
  try {
    // Perform a HEAD request to get content type and determine file extension
    const headResponse = await fetch(url, { method: "HEAD" });
    if (!headResponse.ok) {
      showError(
        "Failed to fetch video headers: ",
        headResponse.status,
        headResponse.statusText
      );
      return;
    }

    let filename = tabTitle || url.split("/").pop().split("?")[0] || "video";

    const contentType = headResponse.headers.get("Content-Type") || "";
    if (contentType.includes("video/")) {
      const ext = contentType.split("/")[1];
      if (ext && !filename.endsWith(`.${ext}`)) {
        filename += `.${ext}`;
      }
    }

    // Initiate the download directly using the original URL
    (browser.downloads || chrome.downloads).download(
      {
        url: url,
        filename: cleanURL(filename, true),
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          showError("Download failed: ", chrome.runtime.lastError.message);
        } else {
          current.downloadId = downloadId;
          current.progress = 0;
        }
      }
    );
  } catch (error) {
    showError("Error initiating download: ", error);
  }
}

(browser.downloads || chrome.downloads).onChanged.addListener((delta) => {
  const downloadId = delta.id;

  const current = Object.values(videoNetworkList).find(
    (video) => video.downloadId === downloadId
  );
  const loadingIndicator = current?.loadingIndicator;

  if (current) {
    if (delta.state && delta.state.current === "complete") {
      loadingIndicator.textContent = "Download complete!";
    } else if (delta.state && delta.state.current === "interrupted") {
      loadingIndicator.textContent = "Download interrupted";
    }
    if (delta.bytesReceived !== undefined && delta.totalBytes !== undefined) {
      current.progress = Math.round(
        (delta.bytesReceived / delta.totalBytes) * 100
      );
      loadingIndicator.textContent = `Downloading... ${current.progress}%`;
    }

    updateVideoUI();
  }
});

function replaceMultiPartNumber(text, search, newNumber) {
  const regex = new RegExp(`${search}(\\d+)`);
  const result = text.replace(regex, `${search}${newNumber}`);

  return result;
}

// Attempt to download a multi-part video by incrementing segment numbers until it fails
async function downloadFullMultipartVideo(video, tabTitle, current) {
  const url = video.url;
  const multiReplace = video.multiReplace;
  const loadingIndicator = current.loadingIndicator;

  let segmentNumber = 429;
  const arrayBuffers = [];

  while (true) {
    const segmentUrl = replaceMultiPartNumber(url, multiReplace, segmentNumber);

    loadingIndicator.textContent = `Downloading segment ${segmentNumber}...`;

    const response = await fetch(segmentUrl);
    if (!response.ok) {
      // No more segments available
      break;
    }
    const buf = await response.arrayBuffer();
    arrayBuffers.push(buf);
    segmentNumber++;
  }

  if (arrayBuffers.length === 0) {
    showError("No segments found for multi-part video");
    return;
  }

  const totalLength = arrayBuffers.reduce(
    (acc, buf) => acc + buf.byteLength,
    0
  );
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const buffer of arrayBuffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  const finalBlob = new Blob([combined], { type: "video/mp4" });
  let filename = `${tabTitle}.mp4` || "combined_video.mp4";

  const objectUrl = URL.createObjectURL(finalBlob);
  (browser.downloads || chrome.downloads).download(
    {
      url: objectUrl,
      filename: cleanURL(filename, true),
      conflictAction: "uniquify",
    },
    (downloadId) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        showError("Download failed: ", chrome.runtime.lastError.message);
      }
    }
  );
}

// A simple utility to clean the filename from query parameters or other unwanted characters
function cleanURL(url, stripQuery) {
  let clean = url;
  if (stripQuery) {
    clean = clean.split("?")[0];
  }
  // Replace any invalid filename characters if needed
  return clean.replace(/[<>:"\/\\|?*]+/g, "_");
}

// every time the tab changes to a new tab, update the UI
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateVideoUI();
});
