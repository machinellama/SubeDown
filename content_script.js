function cleanURLForWindowsFolderName(url) {
  return url.replace(/[<>:"/\\|?*]/g, "-");
}

// Storage for detected videos from heuristics
let detectedVideos = new Set();

// Immediately try to monkey-patch and capture any new video assignments
patchMediaElement();
patchSourceElement();
patchFetch();
patchXHR();

// After DOM scan and monkey-patching, request previously detected videos from background
chrome.runtime.sendMessage({ action: "getDetectedVideos" }, (response) => {
  if (response && response.videos) {
    response.videos.forEach((v) => detectedVideos.add(v));
  }

  // Now that we have background-detected videos, scan the DOM
  // and combine all found video URLs. Then send response when asked.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getVideos") {
      const videos = new Map();
      scanDocumentForVideos(document, videos);
      // Add the detected videos from heuristics and background script
      for (let url of detectedVideos) {
        if (!videos.has(url) && isVideoUrl(url)) {
          const tabURL = document.defaultView.location.href;
          const websiteURL = cleanURLForWindowsFolderName(tabURL);
          const parts = url.split("/");
          const title = parts[parts.length - 1] || "untitled";
          videos.set(url, { url, title, websiteURL });
        }
      }
      sendResponse({ videos: Array.from(videos.values()) });
      return true;
    }

    if (message.action === "getImages") {
      const images = new Map();
      scanDocumentForImages(document, images);
      sendResponse({ images: Array.from(images.values()) });
      return true;
    }
  });
});

function scanDocumentForImages(doc, imagesMap) {
  const tabURL = doc.defaultView.location.href;
  const websiteURL = cleanURLForWindowsFolderName(tabURL);

  function addImage(url, title) {
    if (url && isImageUrl(url) && !imagesMap.has(url)) {
      imagesMap.set(url, { url, title, websiteURL });
    }
  }

  // DOM scanning as before
  doc.querySelectorAll("img").forEach((el) => {
    const url = el.src || el.getAttribute("data-src");
    if (url) {
      const parts = (url || "").split("/");
      const title = parts[parts.length - 1] || "untitled";
      addImage(url, title);
    }
  });

  doc.querySelectorAll("[src]").forEach((el) => {
    const url = el.getAttribute("src");
    if (url && isImageUrl(url)) {
      const parts = url.split("/");
      const title = parts[parts.length - 1] || "untitled";
      addImage(url, title);
    }
  });

  doc
    .querySelectorAll("div, span, section, header, footer, a, li, p")
    .forEach((el) => {
      const bg = doc.defaultView
        .getComputedStyle(el)
        .getPropertyValue("background-image");
      if (bg && bg !== "none") {
        const match = bg.match(/url\(["']?(.*?)["']?\)/);
        if (match && isImageUrl(match[1])) {
          const url = match[1];
          const parts = url.split("/");
          const title = parts[parts.length - 1] || "untitled";
          addImage(url, title);
        }
      }
    });

  // Iframe scanning (same-origin only)
  doc.querySelectorAll("iframe").forEach((iframe) => {
    let iframeDoc = null;
    try {
      iframeDoc =
        iframe.contentDocument ||
        (iframe.contentWindow && iframe.contentWindow.document);
      if (iframeDoc) {
        scanDocumentForImages(iframeDoc, imagesMap);
      }
    } catch (e) {
      // Cross-origin iframe, cannot access
      console.warn("Could not access iframe for images:", e);
    }
  });
}

function scanDocumentForVideos(doc, videosMap) {
  const tabURL = doc.defaultView.location.href;
  const websiteURL = cleanURLForWindowsFolderName(tabURL);

  function addVideo(url, title) {
    if (url && isVideoUrl(url) && !videosMap.has(url)) {
      videosMap.set(url, { url, title, websiteURL });
    }
  }

  // Check <video> elements
  doc.querySelectorAll("video").forEach((el) => {
    const sources = el.querySelectorAll("source");
    if (sources.length > 0) {
      sources.forEach((source) => {
        const url = source.src;
        if (url) {
          const parts = url.split("/");
          const title = parts[parts.length - 1] || "untitled";
          addVideo(url, title);
        }
      });
    } else {
      const url = el.src;
      if (url) {
        const parts = url.split("/");
        const title = parts[parts.length - 1] || "untitled";
        addVideo(url, title);
      }
    }
  });

  // Same-origin iframes
  doc.querySelectorAll("iframe").forEach((iframe) => {
    let iframeDoc = null;
    try {
      iframeDoc =
        iframe.contentDocument ||
        (iframe.contentWindow && iframe.contentWindow.document);
      if (iframeDoc) {
        scanDocumentForVideos(iframeDoc, videosMap);
      }
    } catch (e) {
      console.warn("Could not access iframe for videos:", e);
    }
  });
}

function patchMediaElement() {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "src"
  );
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      set: function (value) {
        if (isVideoUrl(value)) {
          detectedVideos.add(value);
        }
        return originalSrcDescriptor.set.call(this, value);
      },
      get: originalSrcDescriptor.get,
      configurable: true,
    });
  }
}

function patchSourceElement() {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLSourceElement.prototype,
    "src"
  );
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLSourceElement.prototype, "src", {
      set: function (value) {
        if (isVideoUrl(value)) {
          detectedVideos.add(value);
        }
        return originalSrcDescriptor.set.call(this, value);
      },
      get: originalSrcDescriptor.get,
      configurable: true,
    });
  }
}

function patchFetch() {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    if (response && response.url && isVideoUrl(response.url)) {
      detectedVideos.add(response.url);
    }
    return response;
  };
}

function patchXHR() {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (url && isVideoUrl(url)) {
      detectedVideos.add(url);
    }
    return originalOpen.call(this, method, url, ...rest);
  };
}

function isImageUrl(url) {
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(url);
}

function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(url);
}
