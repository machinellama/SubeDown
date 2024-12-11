let sidebarPort = null;

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    sidebarPort = port;

    // Optionally, send initial data or a welcome message
    sidebarPort.postMessage({ type: "init", message: "Sidebar connected." });
  }
});

// Listen for messages from the sidebar (if needed)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download-image" && message.img && message.img.url) {
    const url = message.img.url;
    const filenameOverride = message.img.filename; // This includes the base filename with index and extension
    const foldernameOverride = message.img.foldernameOverride || null;

    downloadImage(url, filenameOverride, foldernameOverride, sendResponse);

    // Indicate that the response will be sent asynchronously
    return true;
  }
});

// Monitor network requests using webRequest API
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const requestInfo = {
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      timeStamp: details.timeStamp,
    };

    // Send the request info to the sidebar if connected
    if (sidebarPort) {
      sidebarPort.postMessage({ type: "network-request", data: requestInfo });
    }
  },
  { urls: ["<all_urls>"] },
  [] // You can specify extraInfoSpec if needed, e.g., ["requestBody"]
);
