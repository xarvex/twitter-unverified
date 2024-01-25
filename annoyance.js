const premium_ad_query = "aside[aria-label='Subscribe to Premium']";
const premium_ad = document.querySelector(premium_ad_query);
if (premium_ad != null)
    premium_ad.parentElement.remove();

// even if element(s) loaded on initial page, Twitter does not do complete reloading
new MutationObserver(function(mutations) {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node instanceof HTMLElement) {
                const premium_ad = node.querySelector(premium_ad_query) ?? node.closest(premium_ad_query);
                if (premium_ad != null)
                    premium_ad.parentElement.remove();
            }
        }
    }
}).observe(document.body, { childList: true, subtree: true });
