let currentTabId;
let imagesData = [];
let downloadSuccess = [];
let downloadFailed = [];

// For videos
let videosData = [];
let downloadSuccessVideos = [];
let downloadFailedVideos = [];

// Advanced settings state
let advancedVisible = false;

// Connect to background for progress updates
let port = chrome.runtime.connect({ name: "sidebar" });
port.onMessage.addListener((msg) => {
  if (msg.action === "video-progress") {
    // Update the progress bar for the given video
    const { url, bytesReceived, totalBytes } = msg;
    updateVideoProgress(url, bytesReceived, totalBytes);
  } else if (msg.action === "video-complete") {
    // Mark video as completed
    const { url } = msg;
    if (!downloadSuccessVideos.includes(url)) {
      downloadSuccessVideos.push(url);
    }
    if (downloadFailedVideos.includes(url)) {
      downloadFailedVideos.splice(downloadFailedVideos.indexOf(url), 1);
    }
    updateVideoStatus(url);
  } else if (msg.action === "video-failed") {
    // Mark video as failed
    const { url, error } = msg;
    console.error(`Download failed for ${url}: ${error}`);
    if (!downloadFailedVideos.includes(url)) {
      downloadFailedVideos.push(url);
    }
    if (downloadSuccessVideos.includes(url)) {
      downloadSuccessVideos.splice(downloadSuccessVideos.indexOf(url), 1);
    }
    updateVideoStatus(url);
  }
});

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

// Videos buttons
document.getElementById("refresh-videos").addEventListener("click", () => {
  showSection("videos");
});
document.getElementById("download-all-videos").addEventListener("click", () => {
  downloadAllVideos();
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
  } else if (section === "videos") {
    fetchVideos();
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

async function fetchVideos() {
  console.log("start fetchVideos");
  let tabs = await browser.tabs.query({ active: true, currentWindow: true });
  let currentTabId = tabs[0].id;
  browser.tabs
    .sendMessage(currentTabId, { action: "getVideos" })
    .then((response) => {
      console.log("getVideos response", response);
      videosData = response.videos;
      renderVideos();
    })
    .catch((error) => console.error(error));
}

function renderImages() {
  const list = document.getElementById("images-list");
  list.innerHTML = "";
  imagesData.forEach((img, index) => {
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

  document.getElementById("images-count").textContent = imagesData.length || 0;
}

function renderVideos() {
  const list = document.getElementById("videos-list");
  list.innerHTML = "";
  videosData.forEach((vid, index) => {
    if (document.getElementById(`video-item-${CSS.escape(vid.url)}`)) {
      return;
    }

    const item = document.createElement("div");
    item.className = "video-item";
    item.id = `video-item-${vid.url}`;

    const thumb = document.createElement("video");
    thumb.src = vid.url;
    thumb.controls = true;
    thumb.style.maxWidth = "5rem";
    thumb.style.maxHeight = "100%";

    const details = document.createElement("div");
    details.className = "video-details";

    const detailActions = document.createElement("div");
    detailActions.className = "detail-actions-row";

    const titleRow = document.createElement("div");
    titleRow.className = "detail-title-row";

    const title = document.createElement("span");
    title.textContent = vid.title || "No title";

    const removeIcon = document.createElement("span");
    removeIcon.className = "remove-icon";
    removeIcon.textContent = "✕";
    removeIcon.addEventListener("click", () => removeVideo(index));

    const btn = document.createElement("button");
    btn.className = "download-btn";
    btn.textContent = "Download";
    btn.addEventListener("click", () => {
      downloadVideo(vid, index);
    });

    const status = document.createElement("span");
    status.id = `video-status-${CSS.escape(vid.url)}`;
    status.className = "image-status";

    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-container";
    progressContainer.id = `video-progress-container-${CSS.escape(vid.url)}`;
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.id = `video-progress-bar-${CSS.escape(vid.url)}`;
    progressContainer.appendChild(progressBar);

    // We'll also show a text overlay of progress in MB
    const progressText = document.createElement("span");
    progressText.className = "progress-text";
    progressText.id = `video-progress-text-${CSS.escape(vid.url)}`;
    progressText.style.position = "absolute";
    progressText.style.bottom = "5px";
    progressText.style.left = "10px";
    progressText.style.fontSize = "12px";
    progressText.style.display = "none";
    progressText.style.color = "#dfe2ed";
    item.appendChild(progressText);

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

  videosData.forEach((vid) => {
    updateVideoStatus(vid.url);
  });

  document.getElementById("videos-count").textContent = videosData.length || 0;
}

function downloadImage(img, index) {
  const originalUrl = img.url;
  let { url, title, websiteURL } = img;

  const replaceText = document.getElementById("replace-text").value;
  const withText = document.getElementById("with-text").value;

  if (replaceText && withText) {
    url = url.split(replaceText).join(withText);
  }

  chrome.runtime.sendMessage(
    { action: "download-image", img: { url, title, websiteURL } },
    (response) => {
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
      updateImageStatus(originalUrl);
    }
  );
}

function downloadVideo(vid, index) {
  const originalUrl = vid.url;
  let { url, title, websiteURL } = vid;

  const replaceText = document.getElementById("replace-text").value;
  const withText = document.getElementById("with-text").value;

  if (replaceText && withText) {
    url = url.split(replaceText).join(withText);
  }

  chrome.runtime.sendMessage(
    { action: "download-video", vid: { url, title, websiteURL } },
    (response) => {
      if (response?.error) {
        console.error(
          `Failed to initiate video download ${url}:`,
          response.error
        );
        if (!downloadFailedVideos.includes(originalUrl)) {
          downloadFailedVideos.push(originalUrl);
        }
        if (downloadSuccessVideos.includes(originalUrl)) {
          downloadSuccessVideos.splice(
            downloadSuccessVideos.indexOf(originalUrl),
            1
          );
        }
        updateVideoStatus(originalUrl);
      } else {
        // Download initiated successfully
        // Progress and completion will be handled via port messages
      }
    }
  );
}

function removeImage(index) {
  imagesData.splice(index, 1);
  renderImages();
}

function removeVideo(index) {
  videosData.splice(index, 1);
  renderVideos();
}

function downloadAllImages() {
  imagesData.forEach((img, i) => {
    downloadImage(img, i);
  });
}

function downloadAllVideos() {
  videosData.forEach((vid, i) => {
    downloadVideo(vid, i);
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

function updateVideoStatus(url) {
  const videoStatus = document.getElementById(
    `video-status-${CSS.escape(url)}`
  );
  if (!videoStatus) {
    return;
  }
  let status;
  if (downloadSuccessVideos.includes(url)) {
    status = "success";
  } else if (downloadFailedVideos.includes(url)) {
    status = "failed";
  } else {
    status = "pending";
  }

  if (status === "success") {
    videoStatus.textContent = "✓";
  }

  if (status === "failed") {
    videoStatus.textContent = "✕";
  }
}

function updateVideoProgress(url, bytesReceived, totalBytes) {
  const progressBar = document.getElementById(
    `video-progress-bar-${CSS.escape(url)}`
  );
  const progressContainer = document.getElementById(
    `video-progress-container-${CSS.escape(url)}`
  );
  const progressText = document.getElementById(
    `video-progress-text-${CSS.escape(url)}`
  );
  if (!progressBar || !progressContainer || !progressText) return;

  progressContainer.style.display = "block";
  progressText.style.display = "block";

  const percent = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
  progressBar.style.width = `${percent}%`;

  const receivedMB = (bytesReceived / (1024 * 1024)).toFixed(2);
  const totalMB =
    totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(2) : "Unknown";
  progressText.textContent = `${receivedMB} MB / ${totalMB} MB`;
}

// Initialize by showing the images section
showSection("images");
