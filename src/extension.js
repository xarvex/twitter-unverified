"use strict";

browser.runtime.onInstalled.addListener(async function() {
    const options = Object.assign({}, {
        handleHome: true,
        handleReplies: true,
        handleSearch: true,
        handleProfile: true,
        handleFollowers: true,
        handleFollowing: false,
        handleConnect: false,

        blueTarget: true,
        blueHardHide: false,
        blueFollowerThreshold: 100000,

        businessTarget: false,
        businessHardHide: false,
        businessFollowerThreshold: -1,

        removePremiumAds: true,
        removeGrok: true,
        removeSubscriptions: false,
        removeAffiliates: false,

        logActions: false
    }, (await browser.storage.sync.get("options"))?.options);
    browser.storage.sync.set({ options });
});
