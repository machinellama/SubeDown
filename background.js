let sidebarPort = null;

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

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    sidebarPort = port;
  }
});
