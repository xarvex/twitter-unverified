const script = document.createElement("script");
script.type = "text/javascript";
script.src = chrome.runtime.getURL("xhr.js");
script.onload = function() {
    this.remove();
};

window.addEventListener("xarvex/twitter-unverified/UserHidden", function(event) {
    if (event.target === window)
        console.log(event.detail);
});
(document.head ?? document.documentElement).appendChild(script);
