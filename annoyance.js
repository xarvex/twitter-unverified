"use strict";

const observedQueries = [];
const elementObserver = new MutationObserver(function(mutations) {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node instanceof HTMLElement)
                for (let k = 0; k < observedQueries.length; k++) {
                    const [query, callback] = observedQueries[k];
                    const element = document.querySelector(query);
                    if (element != null)
                        callback(element);
                }
        }
    }
});
elementObserver.observe(document.body, { childList: true, subtree: true });

function onElement(query, callback) {
    const element = document.querySelector(query);
    if (element != null)
        callback(element);
    observedQueries.push([query, callback]);
}

async function fetchOptions() {
    return (await browser.storage.sync.get("options")).options
}


onElement("aside[aria-label='Subscribe to Premium']", async function(element) {
    if ((await fetchOptions()).removePremiumAds)
        element.parentElement.remove();
});
onElement("a[aria-label='Premium']", async function(element) {
    if ((await fetchOptions()).removePremiumAds)
        element.style.display = "none";
});

onElement("a[aria-label='Grok']", async function(element) {
    if ((await fetchOptions()).removeGrok)
        element.style.display = "none";
});

onElement("div[aria-label^='Subscribe to @']", async function(element) {
    if ((await fetchOptions()).removeSubscriptions)
        element.remove();
});
onElement("a[href$='/superfollows']", async function(element) {
    if ((await fetchOptions()).removeSubscriptions)
        element.parentElement.remove();
});

onElement("a[href$='/affiliates']", async function(element) {
    if ((await fetchOptions()).removeAffiliates)
        element.parentElement.remove();
});

let signalFollowersClick = false;
onElement("a[href$='/verified_followers']", async function(element) {
    if ((await fetchOptions()).handleFollowers) {
        if (element.role === "link")
            element.href = element.href.replace(/verified_followers$/, "followers");
        else {
            if (element.ariaSelected)
                signalFollowersClick = true;
            element.parentElement.remove();
        }
    }
});
onElement("a[href$='/followers'][role='tab']", async function(element) {
    if (signalFollowersClick) {
        element.click();
        signalFollowersClick = false;
    }
});
