function injectScript(path, cb, module = false) {
  var s = document.createElement("script");
  s.src = chrome.runtime.getURL(path);
  if (module) {
    s.type = "module";
  }

  (document.head || document.documentElement).appendChild(s);
  s.onload = () => {
    s.remove();
    cb && cb();
  };
}

window.addEventListener("DOMContentLoaded", (event) => {
  injectScript("LNXP.js", null, true);
});
