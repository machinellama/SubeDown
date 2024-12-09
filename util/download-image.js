function downloadImage(url, sendResponse) {
  try {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const parts = url.split("/");
      const title = parts[parts.length - 1] || `image-${Date.now()}.jpg`;
      const cleanedTitle = cleanURL(title, true);

      const currentTab = tabs[0];
      const tabURL = currentTab.url.split("?")[0];
      const cleanedPart = cleanURL(tabURL, true);
      const folderName = cleanedPart || "images";

      const downloadPath = `${folderName}/${cleanedTitle}`;

      console.log({
        url,
        title,
        cleanedTitle,
        currentTab,
        tabURL,
        cleanedPart,
        folderName,
        downloadPath
      })

      chrome.downloads.download(
        {
          url,
          filename: downloadPath,
          conflictAction: "overwrite",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(
              `Download failed for url: ${url} | downloadPath: ${downloadPath} |`,
              chrome.runtime.lastError.message
            );
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ downloadId });
          }
        }
      );
    });

    return true;
  } catch (error) {
    console.error(`Error processing download for ${url}:`, error);
    sendResponse({ error: error.message });
    return false;
  }
}
