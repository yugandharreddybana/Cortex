/**
 * Bookmarklet generator — produces the `javascript:` URL the user drags
 * to their bookmarks bar. When clicked on any page, it grabs the current
 * selection + URL + title and opens /capture in a popup window.
 *
 * Works in every Chromium browser (Chrome / Edge / Brave / Opera / Arc /
 * Vivaldi) and Firefox / Safari — no extension installation required.
 */
export function buildBookmarklet(appUrl: string): string {
  // Source compressed manually — must stay a single expression to be valid
  // as a `javascript:` URL.  The IIFE:
  //  1. Reads window.getSelection() (truncated to 4 KB)
  //  2. Encodes text/url/title into the /capture query string
  //  3. Opens a 580×720 popup window
  //  4. Falls back to a normal tab if popups are blocked
  const target = `${appUrl.replace(/\/+$/, "")}/capture`;
  const src = `(function(){var t=(window.getSelection()?window.getSelection().toString():'').slice(0,4000);var u=location.href;var d=document.title||'';var q='?text='+encodeURIComponent(t)+'&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(d);var w=window.open('${target}'+q,'cortex_capture','width=580,height=720,resizable=yes,scrollbars=yes');if(!w){location.href='${target}'+q;}})();`;
  return `javascript:${encodeURI(src)}`;
}
