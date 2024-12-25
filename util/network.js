const videoNetworkList = {};
const MAX_NETWORK_LENGTH = 100;
const VIDEO_TYPES = ["video", "media", "xmlhttprequest"];

const MULTIPART_INDICATORS = [
  "chunk-",
  "segment-",
  "part-",
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
  ".m3u8",
];

const invalidTypes = [
  ".mp3",
  "-pic.",
  ".js",
  "/images/",
  "videos_screenshots",
  "thumb-",
  ".css",
  ".js",
  "/preview",
  "/playlist.m3u8"
];

const validTypes = ["stream-1"];

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
  //   includesValidTypes: validTypes.some((ext) => url.includes(ext)),
  // });

  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    if (
      request.type === "xmlhttprequest" &&
      !MULTIPART_INDICATORS.some((indicator) =>
        url.toLowerCase().includes(indicator)
      ) &&
      !url.includes(".m3u8")
    ) {
      return false;
    }

    if (validTypes.some((ext) => url.includes(ext))) {
      return true;
    }

    if (invalidTypes.some((ext) => url.includes(ext))) {
      return false;
    }

    if (!videoExtensions.some((ext) => url.includes(ext))) {
      return false;
    }

    return true;
  }

  if (invalidTypes.some((ext) => url.includes(ext))) {
    return false;
  }

  if (validTypes.some((ext) => url.includes(ext))) {
    return true;
  }

  return videoExtensions.some((ext) => url.includes(ext));
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

    // Determine if this is a multi-part stream or an m3u8 playlist
    let isMultipart = false;
    let isM3U8 = false; // Flag for .m3u8 URLs
    let multipartBaseUrl = request.url;
    let multiReplace = "";
    try {
      const url = new URL(request.url);
      let pathname = url.pathname;
      if (pathname.toLowerCase().endsWith(".m3u8")) {
        isM3U8 = true; // Set flag if URL ends with .m3u8
      } else {
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
      }
    } catch (e) {
      // If URL parsing fails, just leave isMultipart and isM3U8 as false
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
      isM3U8, // Add the isM3U8 flag
      multipartBaseUrl,
      multiReplace,
    };

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
      // console.log('key', key);

      const video = current[key];

      if (!video || !video.url) {
        continue;
      }

      const videoDiv = document.createElement("div");
      videoDiv.classList.add("video-entry");
      // add id and name to the videoDiv
      videoDiv.id = `video-${key}`;
      videoDiv.name = video.url;
      videoDiv.key = key;

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

      let videoAdvancedSection;
      let replaceInput;
      let startNumberInput;
      let endNumberInput;
      let minPlacesInput;

      if (video.isMultipart || video.isM3U8) {
        // Modify condition to include isM3U8
        videoAdvancedSection = document.createElement("div");
        videoAdvancedSection.id = `video-advanced-${key}`;
        videoAdvancedSection.style.display = "none";
        videoAdvancedSection.style.marginBottom = "10px";
        videoDiv.appendChild(videoAdvancedSection);

        // advanced section inputs
        const advancedTitle = document.createElement("div");
        advancedTitle.classList.add("video-advanced-title");
        advancedTitle.textContent = video.isM3U8
          ? "M3U8 Playlist Settings"
          : "Multi-part Segment URL Template";
        videoAdvancedSection.appendChild(advancedTitle);

        if (!video.isM3U8) {
          // Only show multipart inputs if not m3u8
          // Replace in URL
          replaceInput = document.createElement("input");
          replaceInput.id = "multi-part-replace";
          replaceInput.type = "text";
          replaceInput.placeholder = "e.g. seg-{{number}}";
          videoAdvancedSection.appendChild(replaceInput);

          // Start Number:
          startNumberInput = document.createElement("input");
          startNumberInput.id = "multi-part-start-number";
          startNumberInput.type = "number";
          startNumberInput.placeholder = "Start Number";
          videoAdvancedSection.appendChild(startNumberInput);

          // End Number:
          endNumberInput = document.createElement("input");
          endNumberInput.id = "multi-part-end-number";
          endNumberInput.type = "number";
          endNumberInput.placeholder = "End Number";
          videoAdvancedSection.appendChild(endNumberInput);

          // Minimum Places:
          minPlacesInput = document.createElement("input");
          minPlacesInput.id = "multi-part-min-places";
          minPlacesInput.type = "number";
          minPlacesInput.placeholder = "e.g. 3 = 001";
          minPlacesInput.min = "0";
          minPlacesInput.step = "1";
          videoAdvancedSection.appendChild(minPlacesInput);
        } else {
          // For m3u8, you might want to add specific settings if needed
          // Currently, no additional inputs are required
        }
      }

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
          () => {},
          (err) => {}
        );
      });

      let videoAdvancedBtn;
      if (video.isMultipart || video.isM3U8) {
        // Modify condition to include isM3U8
        videoAdvancedBtn = document.createElement("button");
        videoAdvancedBtn.classList.add("copy-btn");
        videoAdvancedBtn.textContent = "Advanced";
        buttonsDiv.appendChild(videoAdvancedBtn);

        videoAdvancedBtn.addEventListener("click", () => {
          videoAdvancedSection.style.display = "block";
        });
      }

      const loadingIndicator = document.createElement("div");
      const keyWithoutFirstPart = key.split(":").slice(1).join(":");
      loadingIndicator.id = `video-loading-${keyWithoutFirstPart}`;
      loadingIndicator.classList.add("loading-indicator");
      loadingIndicator.textContent = "Starting Download...";
      loadingIndicator.style.display = "none"; // Hide initially
      videoDiv.appendChild(loadingIndicator);

      downloadBtn.addEventListener("click", async () => {
        loadingIndicator.style.display = "block";
        downloadBtn.style.display = "none";
        copyBtn.style.display = "none";

        if (video.isMultipart || video.isM3U8) {
          // Modify condition to include isM3U8
          if (videoAdvancedBtn) {
            videoAdvancedBtn.style.display = "none";
          }
          if (videoAdvancedSection) {
            videoAdvancedSection.style.display = "none";
          }
        }

        try {
          current.loadingIndicator = loadingIndicator;
          if (video.isM3U8) {
            // Handle m3u8 downloads
            await downloadM3U8Video(video, tabTitle, current);
          } else if (video.isMultipart) {
            // Handle multi-part downloads
            await downloadFullMultipartVideo(video, tabTitle, current, {
              replace: replaceInput ? replaceInput.value : "",
              startNumber: startNumberInput ? startNumberInput.value : "",
              endNumber: endNumberInput ? endNumberInput.value : "",
              minPlaces: minPlacesInput ? minPlacesInput.value : "",
            });
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

          if (video.isMultipart || video.isM3U8) {
            // Modify condition to include isM3U8
            if (videoAdvancedBtn) {
              videoAdvancedBtn.style.display = "block";
            }
            if (videoAdvancedSection && !video.isM3U8) {
              // Hide only if not m3u8
              videoAdvancedSection.style.display = "none";
            }
          }
        }
      });

      const videoClearBtn = document.getElementById("videos-advanced-clear");
      if (videoClearBtn) {
        // Ensure the element exists
        videoClearBtn.addEventListener("click", () => {
          videoNetworkList[currentTabId] = {};
          updateVideoUI();
        });
      }

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

// New function to handle m3u8 downloads with segment splitting
async function downloadM3U8Video(video, tabTitle, current) {
  const url = video.url;
  const loadingIndicator = current.loadingIndicator;

  try {
    // Fetch the m3u8 playlist
    loadingIndicator.textContent = `Fetching playlist...`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch m3u8 playlist: ", response.statusText);
      return;
    }
    const playlistText = await response.text();

    // Parse the playlist to get segment URLs
    const segmentUrls = parseM3U8Playlist(playlistText, url);
    if (segmentUrls.length === 0) {
      console.error("No segments found in the m3u8 playlist.");
      return;
    }

    // Define the maximum number of segments per part
    const MAX_SEGMENTS_PER_PART = 500;

    // Calculate the number of parts needed
    const totalParts = Math.ceil(segmentUrls.length / MAX_SEGMENTS_PER_PART);

    loadingIndicator.textContent = `Found ${segmentUrls.length} segments. Preparing to download ${totalParts} part(s)...`;

    for (let part = 1; part <= totalParts; part++) {
      // Determine the start and end indices for the current part
      const startIdx = (part - 1) * MAX_SEGMENTS_PER_PART;
      const endIdx = Math.min(part * MAX_SEGMENTS_PER_PART, segmentUrls.length);
      const currentSegmentUrls = segmentUrls.slice(startIdx, endIdx);

      loadingIndicator.textContent = `Downloading part ${part} of ${totalParts} (${currentSegmentUrls.length} segments)...`;

      const arrayBuffers = [];

      for (let i = 0; i < currentSegmentUrls.length; i++) {
        const segmentUrl = currentSegmentUrls[i];
        loadingIndicator.textContent = `Downloading part ${part}/${totalParts}: segment ${i + 1} of ${currentSegmentUrls.length}...`;

        try {
          const segmentResponse = await fetch(segmentUrl);
          if (!segmentResponse.ok) {
            console.warn(
              `Failed to fetch segment ${segmentUrl}: ${segmentResponse.statusText}`
            );
            continue; // Skip failed segments
          }

          const buffer = await segmentResponse.arrayBuffer();
          arrayBuffers.push(buffer);
        } catch (err) {
          console.error(`Error fetching segment ${segmentUrl}: `, err);
        }
      }

      if (arrayBuffers.length === 0) {
        console.error(`No segments were successfully downloaded for part ${part}.`);
        continue; // Skip this part if no segments were downloaded
      }

      // Combine all segments into a single Blob
      const combinedBuffer = combineArrayBuffers(arrayBuffers);
      const finalBlob = new Blob([combinedBuffer], { type: "video/mp4" }); // Assuming MP4 container

      let filename = `${tabTitle}`;
      if (totalParts > 1) {
        filename += `_part${part}`;
      }
      filename += `.mp4`;
      filename = cleanURL(filename, true);

      let filenameOverride = getVideoFilenameOverride() || null;
      let foldernameOverride = getVideoFoldernameOverride() || null;

      if (filenameOverride) {
        filenameOverride += `_${part}.mp4`;
      }

      const folderName = foldernameOverride || "videos";
      let downloadPath;

      if (filenameOverride) {
        downloadPath = `${folderName}/${filenameOverride}`;
      } else {
        downloadPath = `${folderName}/${filename}`;
      }

      // Create an object URL for the Blob and initiate the download
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
          } else {
            current.downloadId = downloadId;
            current.progress = 100;
            loadingIndicator.textContent = `Download complete for part ${part}!`;
          }
        }
      );

      // Revoke the object URL after some time to free up memory
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 10000);
    }

    loadingIndicator.textContent = "All parts downloaded!";
  } catch (error) {
    console.error("Error downloading m3u8 video: ", error);
  }
}

// Utility function to parse m3u8 playlist and extract segment URLs
function parseM3U8Playlist(playlistText, baseUrl) {
  const lines = playlistText.split("\n");
  const segmentUrls = [];

  const base = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      // Handle relative URLs
      if (trimmed.startsWith("http")) {
        segmentUrls.push(trimmed);
      } else {
        segmentUrls.push(new URL(trimmed, base).href);
      }
    }
  }

  return segmentUrls;
}

// Utility function to combine multiple ArrayBuffers into one
function combineArrayBuffers(arrayBuffers) {
  let totalLength = 0;
  for (const buffer of arrayBuffers) {
    totalLength += buffer.byteLength;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of arrayBuffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return combined.buffer;
}

(browser.downloads || chrome.downloads).onChanged.addListener((delta) => {
  const downloadId = delta.id;

  const current = Object.values(videoNetworkList)
    .flatMap((tabVideos) => Object.values(tabVideos))
    .find((video) => video.downloadId === downloadId);
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
    // if segmentSplit[1] is a number
    if (segmentSplit.length > 1 && !isNaN(parseInt(segmentSplit[1], 10))) {
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
      result =
        firstPart.substring(0, firstPart.length - 1) + newLastChar + ".ts";
    }
  } else {
    const regex = new RegExp(`${search}(\\d+)`);
    result = text.replace(regex, `${search}${newNumber}`);
  }

  // console.log("replaceMultiPartNumber", { text, search, newNumber, result });

  return result;
}

// Attempt to download a multi-part video by incrementing segment numbers until it fails
async function downloadFullMultipartVideo(
  video,
  tabTitle,
  current,
  options = {}
) {
  const url = video.url;
  const multiReplace = video.multiReplace;
  const loadingIndicator = current.loadingIndicator;

  // console.log('downloadFullMultipartVideo', { video, tabTitle, current, options });

  const arrayBuffers = [];

  const urlTemplate = options.replace?.trim();
  const startNumber = parseInt(options.startNumber, 10);
  const endNumber = parseInt(options.endNumber, 10);
  const minPlaces = parseInt(options.minPlaces, 10);

  // console.log('downloadFullMultipartVideo', { urlTemplate, startNumber, endNumber, minPlaces });

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

  // Initiate the download using the combined Blob
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
      // Revoke the object URL after some time to free up memory
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 10000);
    }
  );
}

// every time the tab changes to a new tab, update the UI
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateVideoUI();
});

// Function to get Folder Name Override
function getVideoFoldernameOverride() {
  const overrideElement = document.getElementById("video-foldername-override");
  if (!overrideElement) return null;
  const override = overrideElement.value.trim();
  return override.length > 0 ? override : null;
}

// Function to get File Name Override
function getVideoFilenameOverride() {
  const overrideElement = document.getElementById("video-filename-override");
  if (!overrideElement) return null;
  const override = overrideElement.value.trim();
  return override.length > 0 ? override : null;
}

// Utility function to clean URL for filename
function cleanURL(url, replaceSpaces = false) {
  let cleaned = url.replace(/[<>:"/\\|?*]+/g, ""); // Remove illegal filename characters
  if (replaceSpaces) {
    cleaned = cleaned.replace(/\s+/g, "_"); // Replace spaces with underscores
  }
  return cleaned;
}

// Function to log download info every second
function logDownloadInfo() {
  const downloadQuery = { state: "in_progress" };
  browser.downloads.search(downloadQuery).then(downloads => {
    downloads.forEach(downloadItem => {
      const url = downloadItem.url;
      const key = url.split('?')[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);

      // console.log('in progress', {
      //   downloadItem,
      //   url,
      //   key,
      //   loadingIndicator
      // });

      if (loadingIndicator) {
        const currentMB = downloadItem.bytesReceived / 1024 / 1024;
        const totalMB = downloadItem.totalBytes / 1024 / 1024;
        const progress = Math.round((currentMB / totalMB) * 100);
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = `Downloading... ${
          progress
        }% (${currentMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB)`;
      }
    });
  });

  // completed
  const completedQuery = { state: "complete" };
  browser.downloads.search(completedQuery).then(downloads => {
    downloads.forEach(downloadItem => {
      const url = downloadItem.url;
      const key = url.split('?')[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);
      if (loadingIndicator) {
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = "Download complete!";
      }
    });
  });

  // interrupted
  const interruptedQuery = { state: "interrupted" };
  browser.downloads.search(interruptedQuery).then(downloads => {
    downloads.forEach(downloadItem => {
      const url = downloadItem.url;
      const key = url.split('?')[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);
      if (loadingIndicator) {
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = "Download interrupted";
      }
    });
  });
}

// Set an interval to run the function every second
setInterval(logDownloadInfo, 1000);