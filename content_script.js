// content_script.js

function cleanURLForWindowsFolderName(url) {
  return url.replace(/[<>:"/\\|?*]/g, "-");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getImages") {
    console.log("Received 'getImages' request from sidebar.");
    const images = new Map();

    // Function to add image to the map to prevent duplicates
    function addImage(url, title, websiteURL) {
      if (url && isImageUrl(url) && !images.has(url)) {
        images.set(url, { url, title, websiteURL });
      }
    }

    // Check <img> elements
    document.querySelectorAll("img").forEach((el) => {
      const url = el.src || el.getAttribute("data-src");
      // get title from the end of the url
      const parts = url.split("/");
      title = parts[parts.length - 1];

      const tabURL = window.location.href;
      const websiteURL = cleanURLForWindowsFolderName(tabURL);

      console.log({ url, title, tabURL, websiteURL });

      addImage(url, title, websiteURL);
    });

    // Check elements with src attribute (e.g., <source> tags)
    document.querySelectorAll("[src]").forEach((el) => {
      const url = el.getAttribute("src");
      addImage(url, "");
    });

    // Check elements with background-image in styles
    document
      .querySelectorAll("div, span, section, header, footer, a, li, p")
      .forEach((el) => {
        const bg = window
          .getComputedStyle(el)
          .getPropertyValue("background-image");
        if (bg && bg !== "none") {
          const match = bg.match(/url\(["']?(.*?)["']?\)/);
          if (match && isImageUrl(match[1])) {
            addImage(match[1], "");
          }
        }
      });

    console.log(`Found ${images.size} images.`);
    sendResponse({ images: Array.from(images.values()) });

    return true; // Indicates asynchronous response
  }
});

function isImageUrl(url) {
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(url);
}
