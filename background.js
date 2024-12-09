let sidebarPort = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download-image" && message.img) {
    const { url } = message.img;

    downloadImage(url, sendResponse);
  }
});

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    sidebarPort = port;
  }
});
