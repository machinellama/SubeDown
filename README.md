# SubeDown

A fully open-source, privacy-focused, and free Firefox extension for downloading images and videos from web pages, including segmented videos.

No ads, no trackers, no payments, no subscriptions, no "companion" apps, no data leaves the extension.

Firefox Addon: https://addons.mozilla.org/en-US/firefox/addon/subedown/

Github: https://github.com/machinellama/SubeDown

## Features

- **Image Downloader**: Download all images on a web page with one click, with some advanced options:
  - Download Settings:
    - Override the file name or folder name for downloads
    - Replace text in a url when downloading (multiple replaces allowed)
      - supports using _ to replace everything after; example: replace `test=_`with`test=123&other=456`-> will replace`example.com?test=abc`with`example.com?test=123&other=456`
  - Refresh Settings:
    - Filter by image types
    - Filter by image size (min and max)
    - Filter urls that include a specific substring
  - Download from multiple pages, by using a {{number}} placeholder in the url
    - Will apply refresh and download settings to each page
- **Video Downloader**: Download videos on a web page
  - Override the file name or folder name for downloads
  - Supports segmented videos (including .ts, .m4s, and .m3u8 videos)
    - URL template for segmented files; e.g. `https://example.com/video/seg-a3b3{{number}}.ts`; The number usually starts at 0 or 1 and increments by 1; will keep downloading segments until one fails, then all segments will be combined into a single mp4 video

### Troubleshooting
  - Videos are still a work in progress, but it works for many cases
  - If a video doesn't appear in the list, try clicking "clear" and refresh the page, then start playing the video to ensure it's detected

## Screenshots

<img src="images/demo1.png" alt="Image List" width="300" />

<img src="images/demo2.png" alt="Advanced Options" width="200" />

## License

MIT License: free to use for personal and commercial use

## Running Locally

1. Clone the repository

2. Open Firefox and enter `about:debugging#/runtime/this-firefox` in the address bar

3. Click on **This Firefox** in the sidebar

4. Click **Load Temporary Add-on...** and select the `manifest.json` file in the cloned repository

5. Best experience if used in the Firefox sidebar

## Contributing

Anyone is welcome to see and contribute code, or create issues.
