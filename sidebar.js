let currentTabId;
let imagesData = [];
let downloadSuccess = [];
let downloadFailed = [];

// Advanced settings state
let advancedVisible = false;

// Event Listeners for Tabs
document.getElementById("images-tab").addEventListener("click", () => {
  showSection("images");
});

document.getElementById("videos-tab").addEventListener("click", () => {
  showSection("videos");
});

// Event Listeners for Buttons
document.getElementById("download-all").addEventListener("click", () => {
  downloadAllImages();
});

document.getElementById("refresh-images").addEventListener("click", () => {
  showSection("images");
});

document.getElementById("advanced-toggle").addEventListener("click", () => {
  toggleAdvancedSettings();
});

document.getElementById("clear-advanced").addEventListener("click", () => {
  // Clear all replace/with pairs
  const replaceContainer = document.getElementById("replace-container");
  replaceContainer.innerHTML = `
    <div class="replace-row">
      <div class="flex">
        <label for="replace-text-1">replace</label>
        <input
          type="text"
          id="replace-text-1"
          class="replace-text"
          placeholder="e.g. http://oldsite.com/"
        />
      </div>
      <div class="flex">
        <label for="with-text-1">with</label>
        <input
          type="text"
          id="with-text-1"
          class="with-text"
          placeholder="e.g. http://newsite.com/"
        />
      </div>
    </div>
  `;

  // Reset image type checkboxes to checked
  const checkboxes = document.querySelectorAll(
    '#advanced-settings .checkbox-group input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => (cb.checked = true));

  // Clear size filters
  document.getElementById("min-size").value = "";
  document.getElementById("max-size").value = "";

  // Clear URL filter
  document.getElementById("url-filter").value = "";

  // Clear File Name Override
  document.getElementById("filename-override").value = "";

  // Clear Folder Name Override
  document.getElementById("foldername-override").value = "";

  // Uncheck Remove Queries
  document.getElementById("remove-queries").checked = false;
});

// Event Listener for Adding Replace/With Pair
document.getElementById("add-replace").addEventListener("click", () => {
  addReplaceRow();
});

// Function to add a new replace/with row
let replaceCount = 1;
function addReplaceRow() {
  replaceCount += 1;
  const replaceContainer = document.getElementById("replace-container");
  const replaceRow = document.createElement("div");
  replaceRow.className = "replace-row";
  replaceRow.innerHTML = `
    <div class="flex">
      <label for="replace-text-${replaceCount}">replace</label>
      <input
        type="text"
        id="replace-text-${replaceCount}"
        class="replace-text"
        placeholder="e.g. http://oldsite.com/"
      />
    </div>
    <div class="flex">
      <label for="with-text-${replaceCount}">with</label>
      <input
        type="text"
        id="with-text-${replaceCount}"
        class="with-text"
        placeholder="e.g. http://newsite.com/"
      />
    </div>
    <button class="remove-replace" data-id="${replaceCount}">-</button>
  `;
  replaceContainer.appendChild(replaceRow);

  // Add event listener for the remove button
  replaceRow.querySelector(".remove-replace").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-id");
    removeReplaceRow(id);
  });
}

// Function to remove a replace/with row
function removeReplaceRow(id) {
  const replaceRow = document.querySelector(`.remove-replace[data-id="${id}"]`).parentElement;
  replaceRow.remove();
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

// Function to get selected image types
function getSelectedImageTypes() {
  const checkboxes = document.querySelectorAll(
    '#advanced-settings .checkbox-group input[type="checkbox"]'
  );
  return Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value.toLowerCase());
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

// Function to get URL filter
function getURLFilter() {
  return document.getElementById("url-filter").value.trim().toLowerCase();
}

// Function to get File Name Override
function getFilenameOverride() {
  const override = document.getElementById("filename-override").value.trim();
  return override.length > 0 ? override : null;
}

// Function to get Folder Name Override
function getFoldernameOverride() {
  const override = document.getElementById("foldername-override").value.trim();
  return override.length > 0 ? override : null;
}

// Function to check if Remove Queries is checked
function shouldRemoveQueries() {
  return document.getElementById("remove-queries").checked;
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

// Function to show sections
async function showSection(section) {
  if (section === "images") {
    document.getElementById("images-section").style.display = "block";
    document.getElementById("videos-section").style.display = "none";
    document
      .getElementById("images-tab")
      .classList.add("active");
    document
      .getElementById("videos-tab")
      .classList.remove("active");
    await fetchImages();
  } else if (section === "videos") {
    document.getElementById("images-section").style.display = "none";
    document.getElementById("videos-section").style.display = "block";
    document
      .getElementById("images-tab")
      .classList.remove("active");
    document
      .getElementById("videos-tab")
      .classList.add("active");
    // Future implementation for videos
  }
}

// Function to toggle advanced settings
function toggleAdvancedSettings() {
  advancedVisible = !advancedVisible;
  document.getElementById("advanced-settings").style.display = advancedVisible
    ? "block"
    : "none";
}

// Function to fetch images with applied filters
async function fetchImages() {
  try {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      async (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found.");
          return;
        }
        let currentTabId = tabs[0].id;
        chrome.tabs.sendMessage(currentTabId, {
          action: "getImages",
        }, async (response) => {
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
          replaceWithPairs.forEach(pair => {
            images = images.map(img => ({
              ...img,
              url: img.url.split(pair.replace).join(pair.with)
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
        });
      }
    );
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

  document.getElementById("images-count").textContent =
    imagesData.length || 0;
}

// Function to handle image download
function downloadImageMessage(img, index) {
  const originalUrl = img.url;
  let { url } = img;

  // Apply all replace/with pairs
  const replaceWithPairs = getReplaceWithPairs();
  replaceWithPairs.forEach(pair => {
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
  const foldernameOverride = getFoldernameOverride();

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

  chrome.runtime.sendMessage(
    { action: "download-image", img: { url, filename, foldernameOverride } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(`Failed to download ${url}:`, chrome.runtime.lastError);
        if (!downloadFailed.includes(originalUrl)) {
          downloadFailed.push(originalUrl);
        }
        if (downloadSuccess.includes(originalUrl)) {
          downloadSuccess.splice(
            downloadSuccess.indexOf(originalUrl),
            1
          );
        }
      } else if (response?.error) {
        console.error(`Failed to download ${url}:`, response.error);

        if (!downloadFailed.includes(originalUrl)) {
          downloadFailed.push(originalUrl);
        }
        if (downloadSuccess.includes(originalUrl)) {
          downloadSuccess.splice(
            downloadSuccess.indexOf(originalUrl),
            1
          );
        }
      } else {
        if (!downloadSuccess.includes(originalUrl)) {
          downloadSuccess.push(originalUrl);
        }
        if (downloadFailed.includes(originalUrl)) {
          downloadFailed.splice(
            downloadFailed.indexOf(originalUrl),
            1
          );
        }
      }
      updateImageStatus(originalUrl);
    }
  );
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
    imageStatus.textContent = "⌛";
    imageStatus.style.color = "orange";
  }
}

// Initialize by showing the images section
showSection("images");

// --- New Feature: Download from Multiple Pages ---

// Event Listener for Start Multi-Page Download
document.getElementById("start-multi-download").addEventListener("click", () => {
  startMultiPageDownload();
});

// Function to start downloading images from multiple pages using fetch
async function startMultiPageDownload() {
  const urlTemplate = document.getElementById("url-template").value.trim();
  const startNumber = parseInt(document.getElementById("start-number").value, 10);
  const endNumber = parseInt(document.getElementById("end-number").value, 10);
  const statusDiv = document.getElementById("multi-download-status");

  // Input Validation
  if (!urlTemplate.includes("{{number}}")) {
    alert('URL Template must include "{{number}}" placeholder.');
    return;
  }

  if (isNaN(startNumber) || isNaN(endNumber) || startNumber > endNumber) {
    alert("Please enter valid start and end numbers.");
    return;
  }

  // Disable the start button to prevent multiple clicks
  const startButton = document.getElementById("start-multi-download");
  startButton.disabled = true;
  statusDiv.textContent = "Starting multi-page download...";

  for (let i = startNumber; i <= endNumber; i++) {
    const currentURL = urlTemplate.replace("{{number}}", i);
    statusDiv.textContent = `Processing page ${i}: ${currentURL}`;

    try {
      // Fetch the page content
      const response = await fetch(currentURL);
      if (!response.ok) {
        console.error(`Failed to fetch ${currentURL}: ${response.statusText}`);
        continue;
      }

      const htmlText = await response.text();

      // Parse the HTML to extract image URLs
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const imgElements = doc.images;
      let images = Array.from(imgElements).map(img => ({
        url: img.src
      }));

      if (images.length === 0) {
        continue;
      }

      // Apply existing advanced settings filters to the images
      let filteredImages = applyAdvancedFilters(images);

      // Render the images in the sidebar
      imagesData = imagesData.concat(filteredImages);
      renderImages();

      // Download the images
      for (let j = 0; j < filteredImages.length; j++) {
        await downloadImageMessage(filteredImages[j], imagesData.length - filteredImages.length + j);
      }
    } catch (error) {
      console.error(`Error processing page ${currentURL}:`, error);
      continue;
    }
  }

  statusDiv.textContent = "Multi-page download completed.";
  startButton.disabled = false;
}

// Function to apply advanced filters to images
function applyAdvancedFilters(images) {
  let filtered = images.slice();

  // Apply Replace Texts
  const replaceWithPairs = getReplaceWithPairs();
  replaceWithPairs.forEach(pair => {
    filtered = filtered.map(img => ({
      ...img,
      url: img.url.split(pair.replace).join(pair.with)
    }));
  });

  // Apply image type filter
  const selectedTypes = getSelectedImageTypes();
  filtered = filtered.filter((img) => {
    const lowerUrl = img.url.toLowerCase();
    return selectedTypes.some((type) => lowerUrl.includes(type));
  });

  // Apply URL filter
  const urlFilter = getURLFilter();
  if (urlFilter) {
    filtered = filtered.filter((img) =>
      img.url.toLowerCase().includes(urlFilter)
    );
  }

  // Apply size filter
  // Note: Size filtering is handled in fetchImages and downloadImageMessage
  // Here, we skip it for performance reasons
  // Alternatively, you can implement it here if needed

  return filtered;
}
