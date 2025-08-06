// Make sure to use only 2 spaces for indentation in this entire file

// Global data structures
const videoNetworkList = {};
let globalDownloads = {}; // tracks all downloads (single, multi-part, m3u8, etc.)
const DEFAULT_SEGMENT_LIMIT = 1000;

// Constants
const VIDEO_TYPES = ["video", "media", "xmlhttprequest"];
const MULTIPART_INDICATORS = [
  "chunk-",
  "segment-",
  "segment_",
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
  ".mp2t",
];
const invalidTypes = [
  ".mp3",
  ".gif",
  "-pic.",
  ".js",
  "/images/",
  "videos_screenshots",
  "thumb-",
  ".css",
  ".js",
  "/preview",
];
const validTypes = [
  "stream-1",
  "cdn3x",
  ".net/preview/",
  "webapp-prime",
  "/aweme/",
];

// Utility function to determine if a request is a video
function isVideoRequest(request) {
  // console.log('isVideoRequest', request);

  if (!request.url) {
    return false;
  }

  const url = request.url;

  // Check the 'type' field
  if (VIDEO_TYPES.includes(request.type)) {
    if (
      request.type === "xmlhttprequest" &&
      !MULTIPART_INDICATORS.some((indicator) =>
        url.toLowerCase().includes(indicator)
      ) &&
      !url.includes(".m3u8")
    ) {
      // console.log('isVideoRequest returning false because invalid multipart indicator', { request, url });
      return false;
    }

    if (validTypes.some((ext) => url.includes(ext))) {
      // console.log('isVideoRequest returning true because validType', { validTypes, url });
      return true;
    }

    if (invalidTypes.some((ext) => url.includes(ext))) {
      // console.log('isVideoRequest returning false because invalidType', { invalidTypes, url });
      return false;
    }

    const lastDotSplit = url.split(".").pop();
    if (
      lastDotSplit &&
      lastDotSplit.length <= 5 &&
      !videoExtensions.some((ext) => url.includes(ext))
    ) {
      // console.log('isVideoRequest returning false because last dot split', { videoExtensions, lastDotSplit });
      return false;
    }

    if (!videoExtensions.some((ext) => url.includes(ext))) {
      // console.log('isVideoRequest returning false because invalid videoExtensions', { videoExtensions, url });
      return false;
    }

    // console.log('returning true');
    return true;
  }

  if (invalidTypes.some((ext) => url.includes(ext))) {
    return false;
  }

  const lastDotSplit = url.split(".").pop();
  if (
    lastDotSplit &&
    lastDotSplit.length <= 5 &&
    !videoExtensions.some((ext) => url.includes(ext))
  ) {
    return false;
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

  // console.log("addOrUpdateVideo", request.url, {
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

    // console.log("request", request);

    // Update the video entry
    videoNetworkList[request.tabId][videoKey] = {
      url: request.url,
      method: request.method,
      type: request.type,
      tabId: request.tabId,
      tabTitle: request.tabTitle || null,
      origin: request.origin,
      referrer: request.referrer,
      parentURLName: request.parentURLName || null,
      timeStamp: request.timeStamp,
      parts: [], // Array to hold multipart segments if needed
      lastUpdated: Date.now(),
      isMultipart,
      isM3U8,
      multipartBaseUrl,
      multiReplace,
    };

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

    const orderedKeysByTimestamp = currentKeys
      .filter((key) => {
        const video = current[key];
        return video && video.url && video.timeStamp;
      })
      .sort((a, b) => current[b].timeStamp - current[a].timeStamp);

    // check for and remove duplicate video.url entries in orderedKeysByTimestamp
    const seenUrls = [];

    for (const key of orderedKeysByTimestamp) {
      const video = current[key];
      if (!video || !video.url) {
        continue;
      }

      if (!seenUrls.includes(video.url)) {
        seenUrls.push(video.url);

        const videoDiv = document.createElement("div");
        videoDiv.classList.add("video-entry");
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
          videoAdvancedSection = document.createElement("div");
          videoAdvancedSection.id = `video-advanced-${key}`;
          videoAdvancedSection.style.display = "none";
          videoAdvancedSection.style.marginBottom = "10px";
          videoDiv.appendChild(videoAdvancedSection);

          const advancedTitle = document.createElement("div");
          advancedTitle.classList.add("video-advanced-title");
          advancedTitle.textContent = video.isM3U8
            ? "M3U8 Playlist Settings"
            : "Multi-part Segment URL Template";
          videoAdvancedSection.appendChild(advancedTitle);

          if (!video.isM3U8) {
            // Only show multipart inputs if not m3u8
            replaceInput = document.createElement("input");
            replaceInput.id = "multi-part-replace";
            replaceInput.type = "text";
            replaceInput.placeholder = "e.g. test.com/ep.1.1080{{number}}";
            videoAdvancedSection.appendChild(replaceInput);

            startNumberInput = document.createElement("input");
            startNumberInput.id = "multi-part-start-number";
            startNumberInput.type = "number";
            startNumberInput.placeholder = "Start Number";
            videoAdvancedSection.appendChild(startNumberInput);

            endNumberInput = document.createElement("input");
            endNumberInput.id = "multi-part-end-number";
            endNumberInput.type = "number";
            endNumberInput.placeholder = "End Number";
            videoAdvancedSection.appendChild(endNumberInput);

            minPlacesInput = document.createElement("input");
            minPlacesInput.id = "multi-part-min-places";
            minPlacesInput.type = "number";
            minPlacesInput.placeholder = "e.g. 3 = 001";
            minPlacesInput.min = "0";
            minPlacesInput.step = "1";
            videoAdvancedSection.appendChild(minPlacesInput);
          } else {
            // For m3u8, could add specific settings if needed
          }
        }

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
        loadingIndicator.style.display = "none";
        videoDiv.appendChild(loadingIndicator);

        downloadBtn.addEventListener("click", async () => {
          loadingIndicator.style.display = "block";
          downloadBtn.style.display = "none";
          copyBtn.style.display = "none";

          if (video.isMultipart || video.isM3U8) {
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
              await downloadM3U8AsTS(video, current);
            } else if (video.isMultipart) {
              await downloadFullMultipartVideo(video, current, {
                replace: replaceInput ? replaceInput.value : "",
                startNumber: startNumberInput ? startNumberInput.value : "",
                endNumber: endNumberInput ? endNumberInput.value : "",
                minPlaces: minPlacesInput ? minPlacesInput.value : "",
              });
            } else {
              await downloadVideo(video, current);
            }
          } catch (err) {
            console.error("Download failed: ", err);
          } finally {
            loadingIndicator.style.display = "none";
            downloadBtn.style.display = "block";
            copyBtn.style.display = "block";

            if (video.isMultipart || video.isM3U8) {
              if (videoAdvancedBtn) {
                videoAdvancedBtn.style.display = "block";
              }
              if (videoAdvancedSection && !video.isM3U8) {
                videoAdvancedSection.style.display = "none";
              }
            }
          }
        });

        const videoClearBtn = document.getElementById("videos-advanced-clear");
        if (videoClearBtn) {
          videoClearBtn.addEventListener("click", () => {
            videoNetworkList[currentTabId] = {};
            globalDownloads = {};
            updateVideoUI();
          });
        }

        videosSection.appendChild(videoDiv);
      }
    }
  });
}

async function downloadVideo(video, current) {
  try {
    let filenameOverride = getVideoFilenameOverride() || null;
    let foldernameOverride = getVideoFoldernameOverride() || null;

    // Perform a HEAD request to get content type and determine file extension
    const headResponse = await fetch(video.url, { method: "HEAD" });
    if (!headResponse.ok) {
      console.error(
        "Failed to fetch video headers: ",
        headResponse.status,
        headResponse.statusText
      );
      return;
    }

    let filename;
    if (getUseUrlName()) {
      filename =
        video.parentURLName ||
        video.url.split("/").pop().split("?")[0] ||
        "video";
    } else {
      filename =
        video.tabTitle || video.url.split("/").pop().split("?")[0] || "video";
    }

    filename = cleanURL(filename, true);
    let extension;

    const contentType = headResponse.headers.get("Content-Type") || "";
    if (contentType.includes("video/")) {
      extension = contentType.split("/")[1];
      if (extension && !filename.endsWith(`.${extension}`)) {
        filename += `.${extension}`;
      }
    }

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

    // Initiate the download directly using the original URL
    (browser.downloads || chrome.downloads).download(
      {
        url: video.url,
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

// downloadM3U8AsTS: handles optional AES-128 decryption, fMP4 init maps, segment-splitting,
// and uses a Firefox-safe fallback for blob URLs via an <a download> click.
async function downloadM3U8AsTS(video, current) {
  let filename = cleanURL(video.tabTitle, true);
  let filenameOverride = getVideoFilenameOverride() || null;
  let foldernameOverride = getVideoFoldernameOverride() || null;

  const url = video.url;
  const loadingIndicator = current.loadingIndicator;

  // 1) Create unique download ID & register in globalDownloads
  const uniqueId = `m3u8-${video.tabTitle}-${Date.now()}`;
  globalDownloads[uniqueId] = {
    url,
    progress: 0,
    state: "in_progress",
    type: "m3u8",
  };
  updateGlobalDownloadsUI();

  try {
    // 2) Fetch the playlist
    loadingIndicator.textContent = "Fetching playlist…";
    const resp = await fetch(url, {
      origin: video.origin ?? undefined,
      referrer: video.origin ?? undefined,
    });
    if (!resp.ok) {
      throw new Error(`Playlist fetch failed: ${resp.status}`);
    }
    const playlistText = await resp.text();

    // 3) Extract AES-128 key URI + IV, if present
    let keyUri = null,
      ivHex = null;
    for (let line of playlistText.split("\n")) {
      if (line.startsWith("#EXT-X-KEY")) {
        const m = /URI="([^"]+)"/.exec(line);
        const ivm = /IV=0x([0-9A-Fa-f]+)/.exec(line);
        if (m) keyUri = new URL(m[1], url).href;
        if (ivm) ivHex = ivm[1];
        break;
      }
    }

    // 4) If encrypted, fetch the raw key and import into WebCrypto
    let cryptoKey = null,
      ivBuf = null;
    if (keyUri) {
      loadingIndicator.textContent = "Fetching decryption key…";
      const keyBuf = await (await fetch(keyUri)).arrayBuffer();
      cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuf,
        { name: "AES-CBC" },
        false,
        ["decrypt"]
      );
      ivBuf = new Uint8Array(16);
      for (let j = 0; j < 16; j++) {
        ivBuf[j] = parseInt(ivHex.substr(j * 2, 2), 16);
      }
    }

    // 5) Extract an fMP4 init-segment if EXT-X-MAP is present
    const baseUrl = url.replace(/\/[^/]+$/, "/");
    let initSegmentUrl = null;
    for (let line of playlistText.split("\n")) {
      if (line.startsWith("#EXT-X-MAP")) {
        const m = /URI="([^"]+)"/.exec(line);
        if (m) initSegmentUrl = new URL(m[1], baseUrl).href;
        break;
      }
    }

    // 6) Build the list of media-segment URLs
    const segmentUrls = playlistText
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((uri) =>
        uri.startsWith("http") ? uri : new URL(uri, baseUrl).href
      );
    if (!segmentUrls.length) {
      throw new Error("No media segments found in playlist");
    }

    // 7) Determine part-splitting
    const userLimit = parseFloat(
      document.getElementById("video-segment-limit").value
    );
    const MAX_PER_PART = userLimit || DEFAULT_SEGMENT_LIMIT;
    const totalSegments = segmentUrls.length;
    const totalParts = Math.ceil(totalSegments / MAX_PER_PART);
    let downloadedCount = 0;

    //  - If URL is blob:, skip browser.downloads.download()
    //    and do a hidden <a download> click instead.
    async function startDownload(opts) {
      const isBlob = opts.url.startsWith("blob:");
      if (isBlob) {
        console.warn("Firefox + blob URL → using <a download> fallback");
        const a = document.createElement("a");
        a.href = opts.url;
        a.download = opts.filename || "";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return -1; // dummy ID
      }

      // Otherwise we can call the Firefox downloads API
      return (browser.downloads || chrome.downloads)
        .download(opts)
        .catch((err) => {
          console.warn("download API failed, falling back to <a>:", err);
          const a = document.createElement("a");
          a.href = opts.url;
          a.download = opts.filename || "";
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return -1;
        });
    }

    // 8) Loop over each part
    for (let part = 1; part <= totalParts; part++) {
      const startIdx = (part - 1) * MAX_PER_PART;
      const endIdx = Math.min(part * MAX_PER_PART, totalSegments);
      const sliceUrls = segmentUrls.slice(startIdx, endIdx);

      loadingIndicator.textContent = `Downloading part ${part}/${totalParts} — ${sliceUrls.length} segments…`;

      // collect Uint8Array chunks here
      const tsChunks = [];

      // 8a) fMP4 init-segment in part 1
      if (part === 1 && initSegmentUrl) {
        try {
          const initResp = await fetch(initSegmentUrl, {
            origin: video.origin ?? undefined,
            referrer: video.origin ?? undefined,
          });
          if (initResp.ok) {
            tsChunks.push(new Uint8Array(await initResp.arrayBuffer()));
          } else {
            console.warn("Failed to fetch init-segment:", initResp.status);
          }
        } catch (err) {
          console.warn("Error fetching init-segment:", err);
        }
      }

      // 8b) Download & decrypt each media segment
      for (let i = 0; i < sliceUrls.length; i++) {
        const segUrl = sliceUrls[i];
        loadingIndicator.textContent = `Part ${part}/${totalParts}: segment ${
          i + 1
        }/${sliceUrls.length}`;
        try {
          const segResp = await fetch(segUrl, {
            origin: video.origin ?? undefined,
            referrer: video.origin ?? undefined,
          });
          if (!segResp.ok) {
            console.warn("Segment fetch failed:", segUrl, segResp.status);
            continue;
          }
          let buf = await segResp.arrayBuffer();
          if (cryptoKey) {
            buf = await crypto.subtle.decrypt(
              { name: "AES-CBC", iv: ivBuf },
              cryptoKey,
              buf
            );
          }
          tsChunks.push(new Uint8Array(buf));
          downloadedCount++;
          globalDownloads[uniqueId].progress = Math.round(
            (downloadedCount / totalSegments) * 100
          );
          updateGlobalDownloadsUI();
        } catch (err) {
          console.error("Error downloading segment:", segUrl, err);
        }
      }

      if (!tsChunks.length) {
        console.warn(`Part ${part} had no successful segments, skipping`);
        continue;
      }

      // 9) Concatenate all Uint8Array chunks
      let totalLen = tsChunks.reduce((sum, c) => sum + c.byteLength, 0);
      let output = new Uint8Array(totalLen);
      let offset = 0;
      for (let chunk of tsChunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }

      // 10) Build the blob and URL
      const blob = new Blob([output], { type: "video/MP2T" });
      let downloadUrl = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);

      // Build filename & path
      if (totalParts > 1) filename += `_part${part}`;
      filename += ".ts";
      if (filenameOverride) {
        filenameOverride += ".ts";
      }

      const folderName = foldernameOverride || "videos";
      const downloadPath = filenameOverride
        ? `${folderName}/${filenameOverride}`
        : `${folderName}/${filename}`;

      // console.log(`Downloading part ${part} as ${downloadPath}`);

      try {
        await startDownload({
          url: downloadUrl,
          filename: downloadPath,
          conflictAction: "uniquify",
        });
      } catch (dlErr) {
        console.error("Download error:", dlErr);
      }
    }

    // 11) All parts done → mark complete
    globalDownloads[uniqueId].progress = 100;
    globalDownloads[uniqueId].state = "complete";
    updateGlobalDownloadsUI();
    loadingIndicator.textContent = "All parts downloaded!";
  } catch (err) {
    console.error("downloadM3U8AsTS error:", err);
    loadingIndicator.textContent = "Download interrupted!";
    globalDownloads[uniqueId].state = "interrupted";
    updateGlobalDownloadsUI();
  }
}

(browser.downloads || chrome.downloads).onChanged.addListener((delta) => {
  const downloadId = delta.id;

  // Update per-video approach
  const current = Object.values(videoNetworkList)
    .flatMap((tabVideos) => Object.values(tabVideos))
    .find((video) => video.downloadId === downloadId);
  const loadingIndicator = current?.loadingIndicator;

  if (current) {
    if (delta.state && delta.state.current === "complete") {
      if (loadingIndicator) {
        loadingIndicator.textContent = "Download complete!";
      }
    } else if (delta.state && delta.state.current === "interrupted") {
      if (loadingIndicator) {
        loadingIndicator.textContent = "Download interrupted";
      }
    }
    if (delta.bytesReceived !== undefined && delta.totalBytes !== undefined) {
      current.progress = Math.round(
        (delta.bytesReceived / delta.totalBytes) * 100
      );
      if (loadingIndicator) {
        loadingIndicator.textContent = `Downloading... ${current.progress}%`;
      }
    }
    updateVideoUI();
  }
});

// For the standard multi-part approach
function replaceMultiPartNumber(text, search, newNumber) {
  let result;
  if (text.endsWith(".ts")) {
    const slashSplit = text.split("/");
    const segmentPortion = slashSplit[slashSplit.length - 1];
    const segmentSplit = segmentPortion.split("-");
    if (segmentSplit.length > 1 && !isNaN(parseInt(segmentSplit[1], 10))) {
      segmentSplit[1] = newNumber.toString();
      const newSegmentPortion = segmentSplit.join("-");
      slashSplit[slashSplit.length - 1] = newSegmentPortion;
      result = slashSplit.join("/");
    } else {
      const split = text.split(".ts");
      const firstPart = split[0];
      const newLastChar = newNumber.toString();
      result =
        firstPart.substring(0, firstPart.length - 1) + newLastChar + ".ts";
    }
  } else {
    const regex = new RegExp(`${search}(\\d+)`);
    result = text.replace(regex, `${search}${newNumber}`);
  }
  return result;
}

// Attempt to download a multi-part video by incrementing segment numbers
async function downloadFullMultipartVideo(video, current, options = {}) {
  // console.log("video", video);

  let filenameOverride = getVideoFilenameOverride() || null;
  let foldernameOverride = getVideoFoldernameOverride() || null;

  const url = video.url;
  const multiReplace = video.multiReplace;
  const loadingIndicator = current.loadingIndicator;
  const origin = video.origin;

  // console.log('start downloadFullMultipartVideo', { video, tabTitle, current, options, url, multiReplace, loadingIndicator });

  // Create a unique ID for this multi-part download
  const uniqueDownloadId = `multipart-${video.tabTitle}-${Date.now()}`;
  globalDownloads[uniqueDownloadId] = {
    url,
    progress: 0,
    state: "in_progress",
    type: "multipart",
  };
  updateGlobalDownloadsUI();

  try {
    const arrayBuffers = [];
    const audioBuffers = [];

    const urlTemplate = options.replace?.trim();
    const startNumber = parseInt(options.startNumber, 10);
    const endNumber = parseInt(options.endNumber, 10);
    const minPlaces = parseInt(options.minPlaces, 10);

    if (
      (url.includes("seg-") || url.includes("segment_")) &&
      url.includes(".m4s")
    ) {
      let regex;
      if (url.includes("seg-")) {
        regex = new RegExp(`seg-(\\d+)`);
      } else {
        regex = new RegExp(`segment_(\\d+)`);
      }

      let initURL = url.replace(regex, `init`);
      initURL = initURL.replace(".m4s", ".mp4");

      const response = await fetch(initURL, {
        origin: origin ?? undefined,
        referrer: origin ?? undefined,
      });

      // console.log({ initURL, response });

      if (!response.ok) {
        console.error("Failed to fetch initial segment: ", response.statusText);
        globalDownloads[uniqueDownloadId].state = "interrupted";
        updateGlobalDownloadsUI();
        return;
      }
      const buf = await response.arrayBuffer();
      arrayBuffers.push(buf);
    }

    let segmentsDownloaded = 0;

    if (urlTemplate && !isNaN(startNumber) && !isNaN(endNumber)) {
      for (let i = startNumber; i <= endNumber; i++) {
        const paddedNumber = i.toString().padStart(minPlaces, "0");
        const segmentUrl = urlTemplate.replace("{{number}}", paddedNumber);

        loadingIndicator.textContent = `Downloading segment ${paddedNumber}...`;
        const response = await fetch(segmentUrl, {
          origin: origin ?? undefined,
          referrer: origin ?? undefined,
        });
        if (!response.ok) {
          continue;
        }

        const buf = await response.arrayBuffer();
        arrayBuffers.push(buf);
        segmentsDownloaded++;

        globalDownloads[uniqueDownloadId].progress = segmentsDownloaded;
        updateGlobalDownloadsUI();
      }
    } else if (urlTemplate && !isNaN(startNumber)) {
      let i = startNumber;
      while (true) {
        const paddedNumber = i.toString().padStart(minPlaces, "0");
        const segmentUrl = urlTemplate.replace("{{number}}", paddedNumber);

        loadingIndicator.textContent = `Downloading segment ${paddedNumber}...`;
        const response = await fetch(segmentUrl, {
          origin: origin ?? undefined,
          referrer: origin ?? undefined,
        });
        if (!response.ok) {
          break;
        }

        const buf = await response.arrayBuffer();
        arrayBuffers.push(buf);
        segmentsDownloaded++;

        // indefinite totalSegments
        globalDownloads[uniqueDownloadId].progress = segmentsDownloaded;
        updateGlobalDownloadsUI();

        i++;
      }
    } else {
      let segmentNumber = 1;

      if (url.includes("segment_")) {
        segmentNumber = 0;
      }

      while (true) {
        const segmentUrl = replaceMultiPartNumber(
          url,
          multiReplace,
          segmentNumber
        );
        // console.log({ segmentUrl });
        loadingIndicator.textContent = `Downloading segment ${segmentNumber}...`;

        if (segmentUrl.includes("/video/1080p/dash")) {
          const audioURL = segmentUrl.replace(
            "/video/1080p/dash/",
            "/audio/eng/dash/128000/"
          );
          const response = await fetch(audioURL, {
            origin: origin ?? undefined,
            referrer: origin ?? undefined,
          });
          if (!response.ok) {
            break;
          }
          const buf = await response.arrayBuffer();
          arrayBuffers.push(buf);
        }

        const response = await fetch(segmentUrl, {
          origin: origin ?? undefined,
          referrer: origin ?? undefined,
        });
        if (!response.ok) {
          break;
        }
        const buf = await response.arrayBuffer();
        arrayBuffers.push(buf);

        segmentsDownloaded++;

        // indefinite totalSegments
        globalDownloads[uniqueDownloadId].progress = segmentsDownloaded;
        updateGlobalDownloadsUI();

        segmentNumber++;
      }
    }

    if (arrayBuffers.length === 0) {
      console.error("No segments found for multi-part video");
      globalDownloads[uniqueDownloadId].state = "interrupted";
      updateGlobalDownloadsUI();
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

    let filename;
    if (getUseUrlName()) {
      filename = `${video.parentURLName}.mp4` || "combined_video.mp4";
    } else {
      filename = `${video.tabTitle}.mp4` || "combined_video.mp4";
    }

    filename = cleanURL(filename, true);
    let extension = "mp4";

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
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 30000);
      }
    );

    // Mark global download complete
    globalDownloads[uniqueDownloadId].progress = 100;
    globalDownloads[uniqueDownloadId].state = "complete";
    updateGlobalDownloadsUI();
  } catch (err) {
    console.error("Error in multi-part download: ", err);
    globalDownloads[uniqueDownloadId].state = "interrupted";
    updateGlobalDownloadsUI();
  }
}

// Update the UI whenever tab changes
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

// Function to get the “Use URL Name” checkbox value
function getUseUrlName() {
  const checkbox = document.getElementById("use-url-name");
  if (!checkbox) return false;
  return checkbox.checked;
}

// Utility function to clean URL for filename
function cleanURL(url, replaceSpaces = false) {
  let cleaned = url.replace(/[<>:"/\\|?*]+/g, "");
  if (replaceSpaces) {
    cleaned = cleaned.replace(/\s+/g, "_");
  }
  return cleaned;
}

// Function to log download info every second (still shows individual progress labels)
function logDownloadInfo() {
  if (!globalDownloads) {
    globalDownloads = {};
  }

  // in_progress
  const downloadQuery = { state: "in_progress" };
  browser.downloads.search(downloadQuery).then((downloads) => {
    downloads.forEach((downloadItem) => {
      const url = downloadItem.url;
      const key = url.split("?")[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);

      const currentMB = downloadItem.bytesReceived / 1024 / 1024;
      const totalMB = downloadItem.totalBytes / 1024 / 1024;
      const progress = Math.round((currentMB / totalMB) * 100);

      if (loadingIndicator) {
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = `Downloading... ${progress}% (${currentMB.toFixed(
          2
        )} MB / ${totalMB.toFixed(2)} MB)`;
      }

      globalDownloads[key] = {
        url,
        progress,
        state: "in_progress",
        type: "single",
      };
    });
  });

  // completed
  const completedQuery = { state: "complete" };
  browser.downloads.search(completedQuery).then((downloads) => {
    downloads.forEach((downloadItem) => {
      const url = downloadItem.url;
      const key = url.split("?")[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);
      if (loadingIndicator) {
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = "Download complete!";
      }

      delete globalDownloads[key];
    });
  });

  // interrupted
  const interruptedQuery = { state: "interrupted" };
  browser.downloads.search(interruptedQuery).then((downloads) => {
    downloads.forEach((downloadItem) => {
      const url = downloadItem.url;
      const key = url.split("?")[0];
      const loadingIndicator = document.getElementById(`video-loading-${key}`);
      if (loadingIndicator) {
        loadingIndicator.style.display = "block";
        loadingIndicator.textContent = "Download interrupted";
      }

      globalDownloads[key] = {
        url,
        progress: 0,
        state: "interrupted",
        type: "single",
      };
    });
  });

  // Always keep the global downloads UI updated
  updateGlobalDownloadsUI();
}

// Set an interval to run the function every second
setInterval(logDownloadInfo, 1000);

// New function to hide/show a global downloads area and list the active downloads
function updateGlobalDownloadsUI() {
  const container = document.getElementById("global-downloads");
  if (!container) return;

  const listContainer = document.getElementById("global-downloads-list");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  // Render info for all tracked downloads, newest first
  Object.entries(globalDownloads)
    .sort((a, b) => b[0].localeCompare(a[0])) // Sort by downloadId in descending order
    .forEach(([downloadId, data]) => {
      const itemDiv = document.createElement("div");
      const showPercents = data.type !== "m3u8" && data.type !== "multipart";

      if (data.state === "complete") {
        itemDiv.textContent = `ID #${downloadId} | Completed!`;
      } else {
        if (showPercents) {
          itemDiv.textContent = `ID #${downloadId} | State: ${
            data.state
          } | Progress: ${data.progress || 0}%`;
        } else {
          itemDiv.textContent = `ID #${downloadId} | State: ${
            data.state
          } | Progress: ${data.progress || 0} segments`;
        }
      }

      itemDiv.style.borderBottom = "1px solid #ccc";
      itemDiv.style.paddingTop = "2px";
      itemDiv.style.paddingBottom = "2px";

      listContainer.appendChild(itemDiv);
    });
}

const downloadAllVideoBtn = document.getElementById(
  "download-all-videos-button"
);

if (downloadAllVideoBtn) {
  downloadAllVideoBtn.addEventListener("click", async () => {
    // Grab the container that holds all of our video entries
    const videosSection = document.getElementById("videos-list");
    if (!videosSection) {
      return;
    }

    const downloadButtons = videosSection.querySelectorAll(".download-btn");

    for (const btn of downloadButtons) {
      await new Promise((r) => {
        btn.addEventListener("click", () => r(), { once: true });
        btn.click();
      });
    }
  });
}
