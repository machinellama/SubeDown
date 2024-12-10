// find-images.js

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
  const validTypes = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
  ];

  // Check if the URL ends with any valid image type
  return validTypes.some((type) => url.toLowerCase().includes(type));
}
