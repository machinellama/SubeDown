function downloadImage(url, sendResponse) {
  try {
    const cleanedURL = cleanURL(url, true);
    const parts = cleanedURL.split("/");
    const title = parts[parts.length - 1] || `image-${Date.now()}.jpg`;

    const folderName = parts[parts.length - 2] || "images";

    const downloadPath = `${folderName}/${title}`;

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
