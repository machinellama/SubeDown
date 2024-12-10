/**
 * Downloads an image from the given URL.
 * If filenameOverride is provided, uses it as the filename.
 * If foldernameOverride is provided, uses it as the folder name.
 * Otherwise, constructs the filename based on the URL and current tab.
 *
 * @param {string} url - The URL of the image to download.
 * @param {string|null} filenameOverride - The overridden filename, if any.
 * @param {string|null} foldernameOverride - The overridden folder name, if any.
 * @param {function} sendResponse - The callback to send the response.
 */
function downloadImage(url, filenameOverride, foldernameOverride, sendResponse) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error("No active tab found.");
        sendResponse({ error: "No active tab found." });
        return;
      }

      const currentTab = tabs[0];
      const tabURL = currentTab.url.split("?")[0];
      const cleanedPart = cleanURL(tabURL, true);
      const folderName = foldernameOverride || cleanedPart || "images";

      let downloadPath;

      if (filenameOverride) {
        // Use the overridden filename provided by the sidebar
        downloadPath = `${folderName}/${filenameOverride}`;
      } else {
        // Existing logic to construct filename based on URL
        const parts = url.split("/");
        const title = parts[parts.length - 1] || `image-${Date.now()}.jpg`;
        const cleanedTitle = cleanURL(title, true);
        downloadPath = `${folderName}/${cleanedTitle}`;
      }

      console.log({
        url,
        filenameOverride,
        folderName,
        downloadPath
      });

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

    // Indicate that the response will be sent asynchronously
    return true;
  } catch (error) {
    console.error(`Error processing download for ${url}:`, error);
    sendResponse({ error: error.message });
    return false;
  }
}
