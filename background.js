let sidebarPort = null;

// Establish a connection with the sidebar
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar" && !sidebarPort) {
    sidebarPort = port;

    // Optionally, send initial data or a welcome message
    sidebarPort.postMessage({ type: "init", message: "Sidebar connected." });
  }
});

// Monitor network requests using webRequest API
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const parentURL = details.frameAncestors?.[0]?.url || null;
    let parentURLName = "";
    if (parentURL) {
      // get the last split of (/) that's not empty in the parent url
      const split = parentURL.split("/").filter((s) => s);
      for (let i = split.length - 1; i >= 0; i--) {
        if (split[i]) {
          parentURLName = split[i];
          break;
        }
      }
    }

    chrome.tabs.get(details.tabId, (tab) => {
      const tabTitle = tab.title;
      const tabURL = tab.url;

      const requestInfo = {
        url: details.url,
        method: details.method,
        type: details.type,
        tabId: details.tabId,
        timeStamp: details.timeStamp,
        parentURL: details.frameAncestors?.[0]?.url || null,
        tabTitle: tabTitle || null,
        tabURL: tabURL || null,
        parentURLName: parentURLName || null,
      };

      // Send the request info to the sidebar if connected
      if (sidebarPort) {
        sidebarPort.postMessage({ type: "network-request", data: requestInfo });
      }
    });
  },
  { urls: ["<all_urls>"] },
  [] // You can specify extraInfoSpec if needed, e.g., ["requestBody"]
);
