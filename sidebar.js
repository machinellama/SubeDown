// sidebar.js

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
  document.getElementById("replace-text").value = "";
  document.getElementById("with-text").value = "";

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
});

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

          console.log('fetchImages response', response);

          // Apply Replace Text
          const replaceText = document.getElementById("replace-text").value;
          const withText = document.getElementById("with-text").value;
          if (replaceText && withText) {
            images = images.map(img => ({
              ...img,
              url: img.url.split(replaceText).join(withText)
            }));
          }

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
    const titleName = parts[parts.length - 1] || "No title";
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

  const replaceText = document.getElementById("replace-text").value;
  const withText = document.getElementById("with-text").value;

  if (replaceText && withText) {
    url = url.split(replaceText).join(withText);
  }

  chrome.runtime.sendMessage(
    { action: "download-image", img: { url } },
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
