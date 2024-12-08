let currentTabId;
let imagesData = [];
let downloadSuccess = [];
let downloadFailed = [];

// Advanced settings state
let advancedVisible = false;

document.getElementById("images-tab").addEventListener("click", () => {
  showSection("images");
});

document.getElementById("videos-tab").addEventListener("click", () => {
  showSection("videos");
});

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
});

function showSection(section) {
  document.getElementById("images-section").style.display =
    section === "images" ? "block" : "none";
  document.getElementById("videos-section").style.display =
    section === "videos" ? "block" : "none";

  document
    .getElementById("images-tab")
    .classList.toggle("active", section === "images");
  document
    .getElementById("videos-tab")
    .classList.toggle("active", section === "videos");

  if (section === "images") {
    fetchImages();
  }
}

function toggleAdvancedSettings() {
  advancedVisible = !advancedVisible;
  document.getElementById("advanced-settings").style.display = advancedVisible
    ? "block"
    : "none";
}

async function fetchImages() {
  let tabs = await browser.tabs.query({ active: true, currentWindow: true });
  let currentTabId = tabs[0].id;
  browser.tabs
    .sendMessage(currentTabId, { action: "getImages" })
    .then((response) => {
      imagesData = response.images;
      renderImages();
    })
    .catch((error) => console.error(error));
}

function renderImages() {
  const list = document.getElementById("images-list");
  list.innerHTML = "";
  imagesData.forEach((img, index) => {
    // if list already has img.url, skip
    if (document.getElementById(`image-item-${CSS.escape(img.url)}`)) {
      return;
    }

    const item = document.createElement("div");
    item.className = "image-item";
    item.id = `image-item-${img.url}`;

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
    title.textContent = img.title || "No title";

    const removeIcon = document.createElement("span");
    removeIcon.className = "remove-icon";
    removeIcon.textContent = "✕";
    removeIcon.addEventListener("click", () => removeImage(index));

    const btn = document.createElement("button");
    btn.className = "download-btn";
    btn.textContent = "Download";
    btn.addEventListener("click", () => {
      downloadImage(img, index);
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

  // set image count in text of id images-count
  document.getElementById("images-count").textContent = imagesData.length || 0;
}

function downloadImage(img, index) {
  const originalUrl = img.url; // Store the original URL
  let { url, title, websiteURL } = img;

  const replaceText = document.getElementById("replace-text").value;
  const withText = document.getElementById("with-text").value;

  if (replaceText && withText) {
    url = url.split(replaceText).join(withText);
  }

  chrome.runtime.sendMessage({ action: "download-image", img: { url, title, websiteURL } }, (response) => {
    if (response?.error) {
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

    // Update the image status using the original URL
    updateImageStatus(originalUrl);
  });
}

function removeImage(index) {
  imagesData.splice(index, 1);
  renderImages();
}

function downloadAllImages() {
  imagesData.forEach((img, i) => {
    downloadImage(img, i);
  });
}

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
  }

  if (status === "failed") {
    imageStatus.textContent = "✕";
  }
}

// Initialize by showing the images section
showSection("images");
