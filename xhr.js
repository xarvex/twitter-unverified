"use strict";

// define function and run immediately to keep scope
(function() {
    const UserFactor = {
        BLUE: Symbol("Blue"),
        BUSINESS: Symbol("Business")
    };

    class TwitterUser {
        constructor(
            id,
            handle,
            name,
            followers,
            followed = false,
            blocked = false,
            blue = false,
            verificationType = null,
            affiliated = null
        ) {
            this.id = id
            this.handle = handle;
            this.name = name;
            this.followers = followers;
            this.followed = followed;
            this.blocked = blocked;
            this.blue = blue;
            this.verificationType = verificationType;
            this.affiliated = affiliated;
        }
        shouldHide() {
            if (!this.followed) {
                if (this.verificationType === "Business")
                    return UserFactor.BUSINESS;
                else if (this.blue)
                    return UserFactor.BLUE;
            }

            return null;
        }
        markHidden(factor) {
            console.debug(`Hidden @${this.handle} (Twitter ${factor.description} - ${this.followers} followers)`);
            window.dispatchEvent(new CustomEvent("xarvex/twitter-unverified/UserHidden", { detail: this }));
        }
    }
    TwitterUser.fromPost = function(resultData) {
        const userData = resultData["result"]["core"]["user_results"]["result"];
        const legacyUserData = userData["legacy"];

        return new TwitterUser(
            userData["rest_id"],
            legacyUserData["screen_name"],
            legacyUserData["name"],
            legacyUserData["followers_count"],
            legacyUserData?.["following"],
            legacyUserData?.["blocking"],
            userData["is_blue_verified"],
            legacyUserData?.["verified_type"],
            userData?.["affiliates_highlighted_label"]?.["label"]?.["userLabelType"],
        );
    };

    function hidePost(resultData, hard = false, factor = UserFactor.BLUE) {
        if (hard)
            resultData["result"]["__typename"] = "";
        else {
            const old = structuredClone(resultData["result"]);
            delete resultData["result"];
            resultData["result"] = {
                "__typename": "TweetWithVisibilityResults",
                "tweet": old,
                "tweetInterstitial": {
                    "__typename": "ContextualTweetInterstitial",
                    "displayType": "EntireTweet",
                    "text": {
                        "rtl": false,
                        "text": `Twitter ${factor.description} user hidden`,
                        "entities": []
                    },
                    "revealText": {
                        "rtl": false,
                        "text": "View",
                        "entities": []
                    }
                }
            }
        }
    }

    function handlePost(resultData) {
        const user = TwitterUser.fromPost(resultData);

        const factor = user.shouldHide();
        if (factor) {
            hidePost(resultData, false, factor);
            user.markHidden(factor);
            return true;
        } else {
            const quotedResultData = resultData["result"]["quoted_status_result"];
            if (quotedResultData != null)
                handlePost(quotedResultData);
            else {
                const repostResultData = resultData["result"]["legacy"]?.["retweeted_status_result"];
                if (repostResultData != null) {
                    const user = TwitterUser.fromPost(repostResultData);

                    const factor = user.shouldHide();
                    if (factor != null) {
                        hidePost(resultData, false, factor);
                        user.markHidden(factor);
                    }
                }
            }
        }
        return false;
    }

    const TimelineType = {
        HOME: Symbol(),
        REPLIES: Symbol(),
        SEARCH: Symbol(),
        PROFILE: Symbol()
    };

    function isPost(contentData) {
        return contentData["__typename"] === "TimelineTweet" && contentData["tweet_results"]?.["result"]?.["__typename"] === "Tweet";
    }

    // do not reassign data, so value can be modified and returned
    function parseTimeline(data, type) {
        let instructions;
        switch (type) {
            case TimelineType.HOME:
                instructions = data["data"]["home"]["home_timeline_urt"]["instructions"];
                break;
            case TimelineType.REPLIES:
                instructions = data["data"]["threaded_conversation_with_injections_v2"]["instructions"];
                break;
            case TimelineType.SEARCH:
                instructions = data["data"]["search_by_raw_query"]["search_timeline"]["timeline"]["instructions"];
                break;
            case TimelineType.PROFILE:
                instructions = data["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"];
        }

        if (instructions)
            for (let i = 0; i < instructions.length; i++) {
                const instruction = instructions[i];
                if (instruction["type"] === "TimelineAddEntries") {
                    const entries = instruction["entries"];
                    for (let j = 0; j < entries.length; j++) {
                        const entry = entries[j]["content"];
                        switch (entry["entryType"]) {
                            case "TimelineTimelineItem": // post
                                const contentData = entry["itemContent"];
                                if (isPost(contentData))
                                    handlePost(contentData["tweet_results"]);
                                break;
                            case "TimelineTimelineModule": // thread
                                const contentsData = entry["items"];
                                for (let k = 0; k < contentsData.length; k++) {
                                    const contentData = contentsData[k]["item"]["itemContent"];
                                    if (isPost(contentData))
                                        handlePost(contentData["tweet_results"]);
                                }
                                break
                        }
                    }
                }
            }

        return data;
    }

    function overrideResponse(xhr, timelineType) {
        function override() {
            Object.defineProperty(xhr, "responseText", {
                get: function() {
                    delete xhr.responseText;
                    const original = xhr.responseText;

                    let responseText = original;
                    try {
                        responseText = JSON.stringify(parseTimeline(JSON.parse(responseText), timelineType));
                    } catch (e) {
                        // TODO: error handling
                        console.error(e);
                    }

                    override();
                    return responseText ?? original;
                },
                configurable: true
            });
        }

        override();
    }

    // a symbol could be used, but this ensures that multiple instances of
    // the extension will not run for the same request
    const hookedIdentifier = "_xarvex/twitter-unverified/xhr_response_hooked$";
    const xmlOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
        if (args.length >= 2 && args[0] !== "") {
            // home
            if (args[1].search("https://twitter.com/i/api/graphql/.+/Home(?:Latest)?Timeline") === 0) {
                if (!this[hookedIdentifier]) {
                    this[hookedIdentifier] = true;
                    overrideResponse(this, TimelineType.HOME);
                }
            }
            // replies
            else if (args[1].search("https://twitter.com/i/api/graphql/.+/TweetDetail") === 0) {
                if (!this[hookedIdentifier]) {
                    this[hookedIdentifier] = true;
                    overrideResponse(this, TimelineType.REPLIES);
                }
            }
            // search
            else if (args[1].search("https://twitter.com/i/api/graphql/.+/SearchTimeline") === 0) {
                if (!this[hookedIdentifier]) {
                    this[hookedIdentifier] = true;
                    overrideResponse(this, TimelineType.SEARCH);
                }
            }
            // profile
            else if (args[1].search("https://twitter.com/i/api/graphql/.+/User(?:Tweets|Media)") === 0) {
                if (!this[hookedIdentifier]) {
                    this[hookedIdentifier] = true;
                    overrideResponse(this, TimelineType.PROFILE);
                }
            }
        }

        xmlOpen.apply(this, args);
    };

    console.info("Twitter Unverified is ready - with ❤️ from Xarvex");
})();
