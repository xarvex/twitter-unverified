"use strict";

/*
 * It is necessary to inject into the page not only to be able to intercept
 * Twitter's API calls in the first place, but for the ability of changes
 * to be read by the website.
 *
 *  - https://stackoverflow.com/questions/8939467
 *  - https://medium.com/@ddamico.125/b5b9f2ef9466
 *  - https://betterprogramming.pub/dd9ebdf2348b
 */

function dispatchOptions(options) {
    // give page ownership of object
    if (typeof cloneInto === "function")
        options = cloneInto(options, document.defaultView);
    window.dispatchEvent(new CustomEvent("xarvex/twitter-unverified/SettingsUpdate", { detail: options }));
}

const script = document.createElement("script");
script.type = "text/javascript";
script.src = browser.runtime.getURL("xhr.js");
script.onload = async function() {
    this.remove();
    dispatchOptions((await browser.storage.sync.get("options")).options);
};

/* TODO
 * display on settings page with the option to whitelist users
 *
window.addEventListener("xarvex/twitter-unverified/UserHidden", function(event) {
    if (event.target === window)
        console.log(event.detail);
});
*/

browser.storage.onChanged.addListener(function(event) {
    if (event.options?.newValue != null)
        dispatchOptions(event.options.newValue);
});

(document.head ?? document.documentElement).appendChild(script);
