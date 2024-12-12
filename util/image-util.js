const downloadSuccess = [];
const downloadFailed = [];
let imagesData = [];

// Function to fetch images with applied filters
async function fetchImages() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error("No active tab found.");
        return;
      }
      let currentTabId = tabs[0].id;
      chrome.tabs.sendMessage(
        currentTabId,
        {
          action: "getImages",
        },
        async (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            return;
          }

          if (!response || !response.images) {
            console.error("No images found in the response.");
            return;
          }

          let images = response.images;

          // Apply Replace Texts
          const replaceWithPairs = getReplaceWithPairs();
          replaceWithPairs.forEach((pair) => {
            images = images.map((img) => ({
              ...img,
              url: img.url.split(pair.replace).join(pair.with),
            }));
          });

          // Apply image type filter
          const selectedTypes = getSelectedImageTypes();
          images = images.filter((img) => {
            const lowerUrl = img.url.toLowerCase();
            return selectedTypes.some((type) => lowerUrl.includes(type));
          });

          // Apply URL filter
          const urlFilter = getURLFilter();
          if (urlFilter) {
            images = images.filter((img) =>
              img.url.toLowerCase().includes(urlFilter)
            );
          }

          // Apply size filter
          const { min, max } = getSizeFilters();
          if (min !== null || max !== null) {
            const filteredImages = [];
            for (let img of images) {
              const sizeMB = await getImageSize(img.url);
              img.sizeMB = sizeMB;
              if (sizeMB !== null) {
                if (min !== null && sizeMB < min) continue;
                if (max !== null && sizeMB > max) continue;
              }
              filteredImages.push(img);
            }
            imagesData = filteredImages;
          } else {
            imagesData = images;
          }

          renderImages();
        }
      );
    });
  } catch (error) {
    console.error(error);
  }
}

// Function to render images
function renderImages() {
  const list = document.getElementById("images-list");
  list.innerHTML = "";
  imagesData.forEach((img, index) => {
    if (document.getElementById(`image-item-${CSS.escape(img.url)}`)) {
      return;
    }

    const item = document.createElement("div");
    item.className = "image-item";
    item.id = `image-item-${CSS.escape(img.url)}`;

    const thumb = document.createElement("img");
    thumb.src = img.url;
    thumb.alt = `Image ${index + 1}`;

    const details = document.createElement("div");
    details.className = "image-details";

    const detailActions = document.createElement("div");
    detailActions.className = "detail-actions-row";

    const titleRow = document.createElement("div");
    titleRow.className = "detail-title-row";

    const title = document.createElement("span");
    const parts = img.url.split("/");
    const titleName = cleanURL(parts[parts.length - 1] || "No title", true);
    title.textContent = titleName;

    const removeIcon = document.createElement("span");
    removeIcon.className = "remove-icon";
    removeIcon.textContent = "✕";
    removeIcon.addEventListener("click", () => removeImage(index));

    const btn = document.createElement("button");
    btn.className = "download-btn";
    btn.textContent = "Download";
    btn.addEventListener("click", () => {
      downloadImageMessage(img, index);
    });

    const status = document.createElement("span");
    status.id = `image-status-${CSS.escape(img.url)}`;
    status.className = "image-status";

    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-container";
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressContainer.appendChild(progressBar);

    detailActions.appendChild(status);
    detailActions.appendChild(btn);

    titleRow.appendChild(title);
    titleRow.appendChild(removeIcon);

    details.appendChild(titleRow);
    details.appendChild(detailActions);

    item.appendChild(thumb);
    item.appendChild(details);
    item.appendChild(progressContainer);
    list.appendChild(item);
  });

  imagesData.forEach((img) => {
    updateImageStatus(img.url);
  });

  document.getElementById("images-count").textContent = imagesData.length || 0;
}

// Function to handle image download
function downloadImageMessage(img, index, folder = null) {
  const originalUrl = img.url;
  let { url } = img;

  // Apply all replace/with pairs
  const replaceWithPairs = getReplaceWithPairs();
  replaceWithPairs.forEach((pair) => {
    url = url.split(pair.replace).join(pair.with);
  });

  // Get the File Name Override value
  const filenameOverride = getFilenameOverride();
  let filename = null;

  if (filenameOverride) {
    // Extract the file extension from the URL
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];
    const dotIndex = lastPart.lastIndexOf(".");
    let extension = "";
    if (dotIndex !== -1) {
      extension = lastPart.substring(dotIndex);
    }

    // Construct the new filename
    filename = `${filenameOverride}-${index + 1}${extension}`;
  }

  // Get Folder Name Override
  const foldernameOverride = getFoldernameOverride() ?? folder;

  // Check if Remove Queries is checked
  if (shouldRemoveQueries()) {
    try {
      const urlObj = new URL(url);
      urlObj.search = "";
      url = urlObj.toString();
    } catch (e) {
      console.warn(`Invalid URL for removing queries: ${url}`, e);
    }
  }

  if (img.url) {
    const url = img.url;
    const filenameOverride = img.filename; // This includes the base filename with index and extension
    const foldernameOverride = img.foldernameOverride || null;

    function onDownloadImage(response) {
      if (chrome.runtime.lastError) {
        console.error(`Failed to download ${url}:`, chrome.runtime.lastError);
        if (!downloadFailed.includes(originalUrl)) {
          downloadFailed.push(originalUrl);
        }
        if (downloadSuccess.includes(originalUrl)) {
          downloadSuccess.splice(downloadSuccess.indexOf(originalUrl), 1);
        }
      } else if (response?.error) {
        console.error(`Failed to download ${url}:`, response.error);

        if (!downloadFailed.includes(originalUrl)) {
          downloadFailed.push(originalUrl);
        }
        if (downloadSuccess.includes(originalUrl)) {
          downloadSuccess.splice(downloadSuccess.indexOf(originalUrl), 1);
        }
      } else {
        if (!downloadSuccess.includes(originalUrl)) {
          downloadSuccess.push(originalUrl);
        }
        if (downloadFailed.includes(originalUrl)) {
          downloadFailed.splice(downloadFailed.indexOf(originalUrl), 1);
        }
      }
      updateImageStatus(originalUrl);
    }

    downloadImage(url, filenameOverride, foldernameOverride, onDownloadImage);
  }
}

// Function to remove an image from the list
function removeImage(index) {
  imagesData.splice(index, 1);
  renderImages();
}

// Function to download all images
async function downloadAllImages() {
  for (let i = 0; i < imagesData.length; i++) {
    await downloadImageMessage(imagesData[i], i);
  }
}

// Function to update image download status
function updateImageStatus(url) {
  const imageStatus = document.getElementById(
    `image-status-${CSS.escape(url)}`
  );
  if (!imageStatus) {
    return;
  }
  let status;
  if (downloadSuccess.includes(url)) {
    status = "success";
  } else if (downloadFailed.includes(url)) {
    status = "failed";
  } else {
    status = "pending";
  }

  if (status === "success") {
    imageStatus.textContent = "✓";
    imageStatus.style.color = "green";
  }

  if (status === "failed") {
    imageStatus.textContent = "✕";
    imageStatus.style.color = "red";
  }

  if (status === "pending") {
    imageStatus.textContent = "";
    imageStatus.style.color = "orange";
  }
}

// Function to get all replace/with pairs
function getReplaceWithPairs() {
  const replaceTexts = document.querySelectorAll(".replace-text");
  const withTexts = document.querySelectorAll(".with-text");
  const pairs = [];

  replaceTexts.forEach((replaceInput, index) => {
    const withInput = withTexts[index];
    const replaceVal = replaceInput.value.trim();
    const withVal = withInput.value.trim();
    if (replaceVal && withVal) {
      pairs.push({ replace: replaceVal, with: withVal });
    }
  });

  return pairs;
}

// Function to fetch image size in MB
async function getImageSize(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) {
      const size = response.headers.get("Content-Length");
      if (size) {
        return parseInt(size, 10) / (1024 * 1024); // Convert to MB
      }
    }
  } catch (e) {
    console.warn(`Could not fetch size for ${url}:`, e);
  }
  return null;
}

// Function to check if Remove Queries is checked
function shouldRemoveQueries() {
  return document.getElementById("remove-queries").checked;
}

// Function to get Folder Name Override
function getFoldernameOverride() {
  const override = document.getElementById("foldername-override").value.trim();
  return override.length > 0 ? override : null;
}

// Function to get File Name Override
function getFilenameOverride() {
  const override = document.getElementById("filename-override").value.trim();
  return override.length > 0 ? override : null;
}

// Function to get URL filter
function getURLFilter() {
  return document.getElementById("url-filter").value.trim().toLowerCase();
}

// Function to get size filters
function getSizeFilters() {
  const minInput = parseFloat(document.getElementById("min-size").value);
  const maxInput = parseFloat(document.getElementById("max-size").value);

  const min = !isNaN(minInput) && minInput >= 0 ? minInput : null;
  const max = !isNaN(maxInput) && maxInput >= 0 ? maxInput : null;

  if (min !== null && max !== null && min > max) {
    return { min: null, max: null };
  }

  return { min, max };
}

// Function to get selected image types
function getSelectedImageTypes() {
  const checkboxes = document.querySelectorAll(
    '#advanced-settings .checkbox-group input[type="checkbox"]'
  );
  return Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value.toLowerCase());
}

function downloadImage(
  url,
  filenameOverride,
  foldernameOverride,
  sendResponse
) {
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

function findImages(doc, imagesMap) {
  function addImage(url) {
    url = url.trim();
    if (url && isImageUrl(url) && !imagesMap.has(url)) {
      imagesMap.set(url, { url });
    }
  }

  doc.querySelectorAll("img").forEach((el) => {
    const url = el.src || el.getAttribute("data-src");
    if (url) {
      addImage(url);
    }
  });

  doc.querySelectorAll("[src]").forEach((el) => {
    const url = el.getAttribute("src");
    if (url && isImageUrl(url)) {
      addImage(url);
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
          addImage(url);
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
        findImages(iframeDoc, imagesMap);
      }
    } catch (e) {
      console.warn("Could not access iframe for images:", e);
    }
  });
}

function isImageUrl(url) {
  const validTypes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];

  // Check if the URL ends with any valid image type
  return validTypes.some((type) => url.toLowerCase().includes(type));
}
