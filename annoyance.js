"use strict";

const observedQueries = [];
const elementObserver = new MutationObserver(function(mutations) {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node instanceof HTMLElement)
                for (let k = 0; k < observedQueries.length; k++) {
                    const element = document.querySelector(observedQueries[k][0]);
                    if (element != null)
                        observedQueries[k][1](element);
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

onElement("aside[aria-label='Subscribe to Premium']", function(element) {
    element.parentElement.remove();
});
onElement("a[aria-label='Premium']", function(element) {
    element.style.display = "none";
});
onElement("a[aria-label='Grok']", function(element) {
    element.style.display = "none";
});
onElement("div[aria-label^='Subscribe to @']", function(element) {
    element.remove();
});
onElement("a[href$='/superfollows']", function(element) {
    element.parentElement.remove();
});
onElement("a[href$='/affiliates']", function(element) {
    element.parentElement.remove();
});
