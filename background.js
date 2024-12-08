let sidebarPort = null;

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download-image" && message.img) {
    const { url, title, websiteURL } = message.img;

    try {
      let filename = title || `image_${Date.now()}.png`;
      const downloadPath = `${websiteURL}/${filename}`;

      // Initiate the download with overwrite conflict action
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

      // Return true to indicate that the response will be sent asynchronously
      return true;
    } catch (error) {
      console.error(`Error processing download for ${url}:`, error);
      sendResponse({ error: error.message });
      return false;
    }
  }
});

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    sidebarPort = port;
  }
});
