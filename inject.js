/*
 * It is necessary to inject into the page not only to be able to intercept
 * Twitter's API calls in the first place, but for the ability of changes
 * to be read by the website.
 *
 *  - https://stackoverflow.com/questions/8939467
 *  - https://medium.com/@ddamico.125/b5b9f2ef9466
 *  - https://betterprogramming.pub/dd9ebdf2348b
 */

const script = document.createElement("script");
script.type = "text/javascript";
script.src = chrome.runtime.getURL("xhr.js");
script.onload = function() {
    this.remove();
};

/* TODO
 * use user in local storage to filter out tweets on initial page load,
 * which does not get intercepted by xhr.js
 *
window.addEventListener("xarvex/twitter-unverified/UserHidden", function(event) {
    if (event.target === window)
        console.log(event.detail);
});
*/
(document.head ?? document.documentElement).appendChild(script);
