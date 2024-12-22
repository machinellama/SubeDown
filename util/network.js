const videoNetworkList = {};
const MAX_NETWORK_LENGTH = 100;
const VIDEO_TYPES = ["video", "media", "xmlhttprequest"];

const MULTIPART_INDICATORS = [
  "chunk-",
  "segment-",
  "part-",
  "stream-",
  "seg-",
  "ep.",
  "hls-",
];

const videoExtensions = [
  ".mp4",
  ".webm",
  ".ogg",
  ".mkv",
  ".flv",
  ".avi",
  ".mov",
  ".ts",
  ".m4s",
];

const invalidTypes = [
  ".mp3",
  "-pic.",
  ".js",
  "/images/",
  "videos_screenshots",
  "thumb-",
  ".css",
  ".js"
];

// Utility function to determine if a request is a video
function isVideoRequest(request) {
  if (!request.url) {
    return false;
  }

  const url = request.url;

  // console.log("isVideoRequest", {
  //   request,
  //   includesVideoTypes: VIDEO_TYPES.includes(request.type),
  //   includesVideoExtensions: videoExtensions.some((ext) => url.includes(ext)),
  //   includesInvalidTypes: invalidTypes.some((ext) => url.includes(ext)),
  // });

  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    if (
      request.type === "xmlhttprequest" &&
      !MULTIPART_INDICATORS.some((indicator) =>
        url.toLowerCase().includes(indicator)
      )
    ) {
      return false;
    }

    if (!videoExtensions.some((ext) => url.includes(ext))) {
      return false;
    }

    return !invalidTypes.some((ext) => url.includes(ext));
  }

  try {
    if (invalidTypes.some((ext) => url.includes(ext))) {
      return false;
    }

    return videoExtensions.some((ext) => url.includes(ext));
  } catch (e) {
    // If URL parsing fails, assume it's not a video
    return false;
  }
}

// Utility function to generate a unique key for each video
function generateVideoKey(request) {
  try {
    const url = new URL(request.url);
    // Remove query parameters and fragments
    let baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Check for multipart indicators
    for (const indicator of MULTIPART_INDICATORS) {
      const index = baseUrl.toLowerCase().indexOf(indicator);
      if (index !== -1) {
        // Truncate at the indicator to get a base URL for multi-part
        baseUrl = baseUrl.substring(0, index + indicator.length);
        break;
      }
    }

    // Combine with tabId
    return `${request.tabId}:${baseUrl}`;
  } catch (e) {
    // Fallback in case of URL parsing error
    return `${request.tabId}:${request.url}`;
  }
}

// Function to add or update a video entry in videoNetworkList
function addOrUpdateVideo(request) {
  const videoKey = generateVideoKey(request);

  // console.log("addOrUpdateVideo", {
  //   request,
  //   videoKey,
  //   isVideoRequest: isVideoRequest(request),
  //   existing: videoNetworkList[request.tabId]?.[videoKey],
  // });

  if (isVideoRequest(request)) {
    if (!videoNetworkList[request.tabId]) {
      videoNetworkList[request.tabId] = {};
    }

    // Determine if this is a multi-part stream
    let isMultipart = false;
    let multipartBaseUrl = request.url;
    let multiReplace = "";
    try {
      const url = new URL(request.url);
      let pathname = url.pathname;
      for (const indicator of MULTIPART_INDICATORS) {
        const index = pathname.toLowerCase().indexOf(indicator);
        if (index !== -1) {
          // e.g. https://example.com/video/seg-1.ts
          // base would be everything up to seg-
          // In this case we keep indicator to easily append numbers:
          // base: https://example.com/video/seg-
          multipartBaseUrl = `${url.protocol}//${
            url.host
          }${url.pathname.substring(0, index + indicator.length)}`;
          isMultipart = true;
          multiReplace = indicator;
          break;
        }
      }
    } catch (e) {
      // If URL parsing fails, just leave isMultipart as false
    }

    // Update the video entry
    videoNetworkList[request.tabId][videoKey] = {
      url: request.url,
      method: request.method,
      type: request.type,
      tabId: request.tabId,
      tabTitle: request.tabTitle || null,
      parentURLName: request.parentURLName || null,
      timeStamp: request.timeStamp,
      parts: [], // Array to hold multipart segments if needed
      lastUpdated: Date.now(),
      isMultipart,
      multipartBaseUrl,
      multiReplace,
    };

    // console.log("added videoNetworkList", {
    //   videoKey,
    //   entry: videoNetworkList[request.tabId][videoKey],
    // });

    // Manage the size of videoNetworkList
    if (Object.keys(videoNetworkList).length > MAX_NETWORK_LENGTH) {
      // Remove the oldest entry
      const oldestKey = Object.keys(videoNetworkList).reduce((a, b) => {
        return videoNetworkList[a].timeStamp < videoNetworkList[b].timeStamp
          ? a
          : b;
      });
      delete videoNetworkList[oldestKey];
    }

    updateVideoUI();
  }
}

function updateVideoUI() {
  const videosSection = document.getElementById("videos-list");

  if (!videosSection) {
    return;
  }

  videosSection.innerHTML = "";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let currentTabId = tabs[0]?.id;
    const current = videoNetworkList[currentTabId];

    if (!current) {
      return;
    }

    const currentKeys = Object.keys(current);

    for (const key of currentKeys) {
      const video = current[key];

      if (!video) {
        return;
      }

      const videoDiv = document.createElement("div");
      videoDiv.classList.add("video-entry");

      const urlWithoutQuery = video.url.split("?")[0];
      const tabTitle = video.tabTitle;

      const titleDiv = document.createElement("div");
      titleDiv.classList.add("video-title");
      titleDiv.textContent = tabTitle;
      videoDiv.appendChild(titleDiv);

      const urlDiv = document.createElement("div");
      urlDiv.classList.add("video-url");
      urlDiv.textContent = urlWithoutQuery;
      videoDiv.appendChild(urlDiv);

      // video buttons
      const buttonsDiv = document.createElement("div");
      buttonsDiv.classList.add("video-buttons");
      videoDiv.appendChild(buttonsDiv);

      const downloadBtn = document.createElement("button");
      downloadBtn.classList.add("download-btn");
      downloadBtn.textContent = "Download";
      buttonsDiv.appendChild(downloadBtn);

      const copyBtn = document.createElement("button");
      copyBtn.classList.add("copy-btn");
      copyBtn.textContent = "Copy URL";
      buttonsDiv.appendChild(copyBtn);

      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(video.url).then(
          () => {
            console.log("URL copied to clipboard", video.url);
          },
          (err) => {
            console.error("Failed to copy URL to clipboard: ", err);
          }
        );
      });

      const loadingIndicator = document.createElement("div");
      loadingIndicator.classList.add("loading-indicator");
      loadingIndicator.textContent = "Starting Download...";
      videoDiv.appendChild(loadingIndicator);

      downloadBtn.addEventListener("click", async () => {
        loadingIndicator.style.display = "block";
        downloadBtn.style.display = "none";
        copyBtn.style.display = "none";

        try {
          current.loadingIndicator = loadingIndicator;
          if (video.isMultipart) {
            // Attempt multi-part download
            await downloadFullMultipartVideo(video, tabTitle, current);
          } else {
            // Normal single video download
            await downloadVideo(video.url, tabTitle, current);
          }
        } catch (err) {
          console.error("Download failed: ", err);
        } finally {
          loadingIndicator.style.display = "none";
          downloadBtn.style.display = "block";
          copyBtn.style.display = "block";
        }
      });

      const videoClearBtn = document.getElementById("videos-advanced-clear");
      videoClearBtn.addEventListener("click", () => {
        videoNetworkList[currentTabId] = {};
        updateVideoUI();
      });

      videosSection.appendChild(videoDiv);
    }
  });
}

async function downloadVideo(url, tabTitle, current) {
  try {
    // Perform a HEAD request to get content type and determine file extension
    const headResponse = await fetch(url, { method: "HEAD" });
    if (!headResponse.ok) {
      console.error(
        "Failed to fetch video headers: ",
        headResponse.status,
        headResponse.statusText
      );
      return;
    }

    let filename = tabTitle || url.split("/").pop().split("?")[0] || "video";
    filename = cleanURL(filename, true);
    let extension;

    const contentType = headResponse.headers.get("Content-Type") || "";
    if (contentType.includes("video/")) {
      extension = contentType.split("/")[1];
      if (extension && !filename.endsWith(`.${extension}`)) {
        filename += `.${extension}`;
      }
    }

    let filenameOverride = getVideoFilenameOverride() || null;
    let foldernameOverride = getVideoFoldernameOverride() || null;

    if (filenameOverride) {
      // Construct the new filename
      filenameOverride += `.${extension}`;
    }

    const folderName = foldernameOverride || "videos";
    let downloadPath;

    if (filenameOverride) {
      // Use the overridden filename provided by the sidebar
      downloadPath = `${folderName}/${filenameOverride}`;
    } else {
      downloadPath = `${folderName}/${filename}`;
    }

    // Initiate the download directly using the original URL
    (browser.downloads || chrome.downloads).download(
      {
        url: url,
        filename: downloadPath,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error("Download failed: ", chrome.runtime.lastError.message);
        } else {
          current.downloadId = downloadId;
          current.progress = 0;
        }
      }
    );
  } catch (error) {
    console.error("Error initiating download: ", error);
  }
}

(browser.downloads || chrome.downloads).onChanged.addListener((delta) => {
  const downloadId = delta.id;

  const current = Object.values(videoNetworkList).find(
    (video) => video.downloadId === downloadId
  );
  const loadingIndicator = current?.loadingIndicator;

  if (current) {
    if (delta.state && delta.state.current === "complete") {
      loadingIndicator.textContent = "Download complete!";
    } else if (delta.state && delta.state.current === "interrupted") {
      loadingIndicator.textContent = "Download interrupted";
    }
    if (delta.bytesReceived !== undefined && delta.totalBytes !== undefined) {
      current.progress = Math.round(
        (delta.bytesReceived / delta.totalBytes) * 100
      );
      loadingIndicator.textContent = `Downloading... ${current.progress}%`;
    }

    updateVideoUI();
  }
});

function replaceMultiPartNumber(text, search, newNumber) {
  // if text ends in .ts, replace the single character right before .ts
  // example: test.com/llama3a0.ts -> test.com/llama3a1.ts
  let result;
  if (text.endsWith(".ts")) {
    const slashSplit = text.split("/");
    const segmentPortion = slashSplit[slashSplit.length - 1];
    const segmentSplit = segmentPortion.split("-");
    // if segmentSplit[0] is a number
    if (parseInt(segmentSplit[1]) !== NaN) {
      // replace segmentSplit[1] with newNumber and create the full URL
      segmentSplit[1] = newNumber.toString();
      const newSegmentPortion = segmentSplit.join("-");
      slashSplit[slashSplit.length - 1] = newSegmentPortion;
      result = slashSplit.join("/");
    } else {
      const split = text.split(".ts");
      const firstPart = split[0];

      // replace last char with newNumber
      const newLastChar = newNumber.toString();
      result = firstPart.substring(0, firstPart.length - 1) + newLastChar + ".ts";
    }
  } else {
    const regex = new RegExp(`${search}(\\d+)`);
    result = text.replace(regex, `${search}${newNumber}`);
  }

  // console.log("replaceMultiPartNumber", { text, search, newNumber, result });

  return result;
}

// Attempt to download a multi-part video by incrementing segment numbers until it fails
async function downloadFullMultipartVideo(video, tabTitle, current) {
  const url = video.url;
  const multiReplace = video.multiReplace;
  const loadingIndicator = current.loadingIndicator;

  const arrayBuffers = [];

  const urlTemplate = document
    .getElementById("multi-part-replace")
    .value.trim();
  const startNumber = parseInt(
    document.getElementById("multi-part-start-number").value,
    10
  );
  const endNumber = parseInt(
    document.getElementById("multi-part-end-number").value,
    10
  );
  const minPlaces = parseInt(
    document.getElementById("multi-part-min-places").value,
    10
  );

  // if the url has "seg-" and ".m4s", then need to get an initial segment
  if (url.includes("seg-") && url.includes(".m4s")) {
    const regex = new RegExp(`seg-(\\d+)`);
    let initURL = url.replace(regex, `init`);

    // also replace the .m4s with .mp4
    initURL = initURL.replace(".m4s", ".mp4");

    const response = await fetch(initURL);
    if (!response.ok) {
      console.error("Failed to fetch initial segment: ", response.statusText);
      return;
    }
    const buf = await response.arrayBuffer();
    arrayBuffers.push(buf);
  }

  if (urlTemplate && !isNaN(startNumber) && !isNaN(endNumber)) {
    for (let i = startNumber; i <= endNumber; i++) {
      const paddedNumber = i.toString().padStart(minPlaces, "0");

      const segmentUrl = urlTemplate.replace("{{number}}", paddedNumber);

      loadingIndicator.textContent = `Downloading segment ${paddedNumber}...`;

      const response = await fetch(segmentUrl);
      if (!response.ok) {
        // Go to next number
        continue;
      }

      const buf = await response.arrayBuffer();
      arrayBuffers.push(buf);
    }
  } else if (urlTemplate && !isNaN(startNumber)) {
    let i = startNumber;

    while (true) {
      const paddedNumber = i.toString().padStart(minPlaces, "0");

      const segmentUrl = urlTemplate.replace("{{number}}", paddedNumber);

      loadingIndicator.textContent = `Downloading segment ${paddedNumber}...`;

      const response = await fetch(segmentUrl);
      if (!response.ok) {
        // Go to next number
        break;
      }

      const buf = await response.arrayBuffer();
      arrayBuffers.push(buf);
      i++;
    }
  } else {
    let segmentNumber = 1;

    while (true) {
      const segmentUrl = replaceMultiPartNumber(
        url,
        multiReplace,
        segmentNumber
      );

      loadingIndicator.textContent = `Downloading segment ${segmentNumber}...`;

      const response = await fetch(segmentUrl);
      if (!response.ok) {
        // No more segments available
        break;
      }
      const buf = await response.arrayBuffer();
      arrayBuffers.push(buf);
      segmentNumber++;
    }
  }

  if (arrayBuffers.length === 0) {
    console.error("No segments found for multi-part video");
    return;
  }

  const totalLength = arrayBuffers.reduce(
    (acc, buf) => acc + buf.byteLength,
    0
  );
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const buffer of arrayBuffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  const finalBlob = new Blob([combined], { type: "video/mp4" });
  let filename = `${tabTitle}.mp4` || "combined_video.mp4";
  filename = cleanURL(filename, true);
  let extension = "mp4";

  let filenameOverride = getVideoFilenameOverride() || null;
  let foldernameOverride = getVideoFoldernameOverride() || null;

  if (filenameOverride) {
    filenameOverride += `.${extension}`;
  }

  const folderName = foldernameOverride || "videos";
  let downloadPath;

  if (filenameOverride) {
    downloadPath = `${folderName}/${filenameOverride}`;
  } else {
    downloadPath = `${folderName}/${filename}`;
  }

  const objectUrl = URL.createObjectURL(finalBlob);
  (browser.downloads || chrome.downloads).download(
    {
      url: objectUrl,
      filename: downloadPath,
      conflictAction: "uniquify",
    },
    (downloadId) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error("Download failed: ", chrome.runtime.lastError.message);
      }
    }
  );
}

// every time the tab changes to a new tab, update the UI
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateVideoUI();
});

// Function to get Folder Name Override
function getVideoFoldernameOverride() {
  const override = document
    .getElementById("video-foldername-override")
    .value.trim();
  return override.length > 0 ? override : null;
}

// Function to get File Name Override
function getVideoFilenameOverride() {
  const override = document
    .getElementById("video-filename-override")
    .value.trim();
  return override.length > 0 ? override : null;
}
