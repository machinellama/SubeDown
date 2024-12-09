// Listen for requests from sidebar or other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getImages") {
    const images = new Map();
    findImages(document, images);
    sendResponse({ images: Array.from(images.values()) });
    return true;
  }
});
