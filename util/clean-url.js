function cleanURL(url, removeQuery = false) {
  // transform any URL encoded values back to normal characters
  let newURL = decodeURIComponent(url);

  if (removeQuery) {
    // remove the query string from the URL
    newURL = newURL.split("?")[0];
  }

  // replace invalid characters with dashes
  newURL = newURL.replace(/[<>:"/\\|?*]/g, "-");

  // replace multiple dashes with a single dash
  newURL = newURL.replace(/-+/g, "-");

  // replace the work "https" with an empty string
  newURL = newURL.replace(/https/g, "");

  // replace the work "http" with an empty string
  newURL = newURL.replace(/http/g, "");

  // replace any starting or trailing dashes with empty string
  newURL = newURL.replace(/^-|-$/g, "");

  return newURL;
}
