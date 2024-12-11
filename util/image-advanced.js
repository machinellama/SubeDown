// Function to apply advanced filters to images
function applyAdvancedFilters(images) {
  let filtered = images.slice();

  // Apply Replace Texts
  const replaceWithPairs = getReplaceWithPairs();
  replaceWithPairs.forEach((pair) => {
    filtered = filtered.map((img) => ({
      ...img,
      url: img.url.split(pair.replace).join(pair.with),
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
  const replaceRow = document.querySelector(
    `.remove-replace[data-id="${id}"]`
  ).parentElement;
  replaceRow.remove();
}

// Function to toggle advanced settings
function toggleAdvancedSettings() {
  advancedVisible = !advancedVisible;
  document.getElementById("advanced-settings").style.display = advancedVisible
    ? "block"
    : "none";
}

// Event Listener for Start Multi-Page Download
document
  .getElementById("start-multi-download")
  .addEventListener("click", () => {
    startMultiPageDownload();
  });

// Function to start downloading images from multiple pages using fetch
async function startMultiPageDownload() {
  const urlTemplate = document.getElementById("url-template").value.trim();
  const startNumber = parseInt(
    document.getElementById("start-number").value,
    10
  );
  const endNumber = parseInt(document.getElementById("end-number").value, 10);
  const minPlaces = parseInt(document.getElementById("min-places").value, 10);
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
    const paddedNumber = i.toString().padStart(minPlaces, "0");
    const currentURL = urlTemplate.replace("{{number}}", paddedNumber);
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
      let images = Array.from(imgElements).map((img) => ({
        url: img.src,
      }));

      if (images.length === 0) {
        continue;
      }

      // Apply existing advanced settings filters to the images
      let filteredImages = applyAdvancedFilters(images);

      // Render the images in the sidebar
      imagesData = imagesData.concat(filteredImages);
      renderImages();

      const currentPageURL = currentURL.split("?")[0];
      const cleanedPart = cleanURL(currentPageURL, true);

      // Download the images
      for (let j = 0; j < filteredImages.length; j++) {
        await downloadImageMessage(
          filteredImages[j],
          imagesData.length - filteredImages.length + j,
          cleanedPart
        );
      }
    } catch (error) {
      console.error(`Error processing page ${currentURL}:`, error);
      continue;
    }
  }

  statusDiv.textContent = "Multi-page download completed.";
  startButton.disabled = false;
}
