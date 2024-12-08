let sidebarPort = null;
let downloadsMap = {};
// Structure: downloadsMap[downloadId] = { type: "video", url, websiteURL } for videos

// A set to store detected video URLs from network traffic
let detectedVideoURLs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download-image" && message.img) {
    const { url, title, websiteURL } = message.img;

    try {
      let filename = title || `image_${Date.now()}.png`;
      const downloadPath = `${websiteURL}/${filename}`;

      chrome.downloads.download(
        {
          url,
          filename: downloadPath,
          conflictAction: "overwrite",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(
              `Download failed for ${url}:`,
              chrome.runtime.lastError.message
            );
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ downloadId });
          }
        }
      );

      return true;
    } catch (error) {
      console.error(`Error processing download for ${url}:`, error);
      sendResponse({ error: error.message });
      return false;
    }
  }

  if (message.action === "download-video" && message.vid) {
    const { url, title, websiteURL } = message.vid;

    try {
      let filename = title || `video_${Date.now()}.mp4`;
      const downloadPath = `${websiteURL}/${filename}`;

      chrome.downloads.download(
        {
          url,
          filename: downloadPath,
          conflictAction: "overwrite",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(
              `Video Download failed for ${url}:`,
              chrome.runtime.lastError.message
            );
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            downloadsMap[downloadId] = { type: "video", url, websiteURL };
            sendResponse({ downloadId });
          }
        }
      );

      return true;
    } catch (error) {
      console.error(`Error processing video download for ${url}:`, error);
      sendResponse({ error: error.message });
      return false;
    }
  }

  // When content_script requests detected videos
  if (message.action === "getDetectedVideos") {
    // Return the set of detected video URLs
    sendResponse({ videos: Array.from(detectedVideoURLs) });
    return true;
  }
});

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    sidebarPort = port;
  }
});

// Listen for download changes to track video progress
chrome.downloads.onChanged.addListener((delta) => {
  if (!downloadsMap[delta.id]) return;

  const info = downloadsMap[delta.id];
  if (info.type === "video") {
    if (delta.state && delta.state.current === "complete") {
      // Download complete
      if (sidebarPort) {
        sidebarPort.postMessage({
          action: "video-complete",
          url: info.url,
        });
      }
      delete downloadsMap[delta.id];
    } else if (delta.state && delta.state.current === "interrupted") {
      // Download failed
      if (sidebarPort) {
        let error = "unknown";
        if (delta.error) {
          error = delta.error;
        }
        sidebarPort.postMessage({
          action: "video-failed",
          url: info.url,
          error: error,
        });
      }
      delete downloadsMap[delta.id];
    } else {
      // Progress update
      chrome.downloads.search({ id: delta.id }, (results) => {
        if (results && results.length > 0) {
          let item = results[0];
          if (sidebarPort && item.totalBytes > 0) {
            sidebarPort.postMessage({
              action: "video-progress",
              url: info.url,
              bytesReceived: item.bytesReceived,
              totalBytes: item.totalBytes,
            });
          }
        }
      });
    }
  }
});

// Use webRequest API to detect video files
// Note: Add "permissions": ["webRequest", "webRequestBlocking", "<all_urls>"] in manifest.json
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url && isVideoUrl(details.url)) {
      detectedVideoURLs.add(details.url);
    }
  },
  { urls: ["<all_urls>"] },
  []
);

// Optional: You could use onHeadersReceived to confirm MIME type if needed
// Example:
// chrome.webRequest.onHeadersReceived.addListener(
//   (details) => {
//     if (details.responseHeaders) {
//       for (let header of details.responseHeaders) {
//         if (header.name.toLowerCase() === "content-type" && header.value && header.value.toLowerCase().includes("video")) {
//           detectedVideoURLs.add(details.url);
//           break;
//         }
//       }
//     }
//   },
//   { urls: ["<all_urls>"], types: ["media"] },
//   []
// );

function isVideoUrl(url) {
  // Basic heuristic by file extension
  return /\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(url);
}
