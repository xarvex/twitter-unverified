"use strict";

// define function and run immediately to keep scope
(function() {
    const UserFactor = {
        BLUE: Symbol("Blue"),
        BUSINESS: Symbol("Business")
    };

    class TwitterUser {
        constructor(userData) {
            const legacyUserData = userData["legacy"];

            this.id = userData["rest_id"];
            this.handle = legacyUserData["screen_name"];
            this.name = legacyUserData["name"];
            this.followers = legacyUserData["followers_count"];
            this.followed = legacyUserData?.["following"];
            this.blocked = legacyUserData?.["blocking"];
            this.blue = userData["is_blue_verified"];
            this.verificationType = legacyUserData?.["verified_type"];
            this.affiliated = userData?.["affiliates_highlighted_label"]?.["label"]?.["userLabelType"];
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
        return new TwitterUser(resultData["result"]["core"]["user_results"]["result"]);
    };

    function hidePost(postResultData, hard = false, factor = UserFactor.BLUE) {
        if (hard)
            postResultData["result"]["__typename"] = "";
        else {
            const old = structuredClone(postResultData["result"]);
            delete postResultData["result"];
            postResultData["result"] = {
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

    function handlePost(postResultData) {
        const user = TwitterUser.fromPost(postResultData);

        const factor = user.shouldHide();
        if (factor != null) {
            hidePost(postResultData, false, factor);
            user.markHidden(factor);

            return true;
        } else {
            const quotedResultData = postResultData["result"]["quoted_status_result"];
            if (quotedResultData != null)
                handlePost(quotedResultData);
            else {
                const repostResultData = postResultData["result"]["legacy"]?.["retweeted_status_result"];
                if (repostResultData != null) {
                    const user = TwitterUser.fromPost(repostResultData);

                    const factor = user.shouldHide();
                    if (factor != null) {
                        hidePost(postResultData, false, factor);
                        user.markHidden(factor);
                    }
                }
            }
        }

        return false;
    }

    function handleUser(timelineUserData) {
        const user = new TwitterUser(timelineUserData["user_results"]["result"]);

        const factor = user.shouldHide();
        if (factor != null) {
            // no true "hiding" mechanism exists, must remove
            timelineUserData["user_results"]["result"]["__typename"] = "";
            user.markHidden(factor);
        }
    }

    const TimelineType = {
        HOME: Symbol(),
        REPLIES: Symbol(),
        SEARCH: Symbol(),
        PROFILE: Symbol(),
        CONNECT: Symbol()
    };

    function isPost(contentData) {
        return contentData["__typename"] === "TimelineTweet" &&
            contentData["tweet_results"]?.["result"]?.["__typename"] === "Tweet";
    }

    function isUser(contentData) {
        return contentData["__typename"] === "TimelineUser" &&
            contentData["user_results"]["result"]["__typename"] === "User";
    }

    function handleInstructionEntry(entry) {
        switch (entry["entryType"]) {
            case "TimelineTimelineItem": // post
                const timelineItemData = entry["itemContent"];
                if (isPost(timelineItemData))
                    handlePost(timelineItemData["tweet_results"]);
                break;
            case "TimelineTimelineModule": // thread
                const timelineItemsData = entry["items"];
                for (let k = 0; k < timelineItemsData.length; k++) {
                    const timelineItemData = timelineItemsData[k]["item"]["itemContent"];
                    if (isPost(timelineItemData))
                        handlePost(timelineItemData["tweet_results"]);
                    else if (isUser(timelineItemData))
                        handleUser(timelineItemData);
                }
                break
        }
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
                break;
            case TimelineType.CONNECT:
                instructions = data["data"]["connect_tab_timeline"]["timeline"]["instructions"];
        }

        if (instructions != null)
            for (let i = 0; i < instructions.length; i++) {
                const instruction = instructions[i];
                switch (instruction["type"]) {
                    case "TimelineAddEntries":
                        const entries = instruction["entries"];
                        for (let j = 0; j < entries.length; j++) {
                            const entry = entries[j]["content"];
                            handleInstructionEntry(entry);
                        }
                        break;
                    case "TimelinePinEntry":
                        handleInstructionEntry(instruction["entry"]["content"]);
                        break;
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

    function overrideAPIRoute(xhr, url, timelineType, routeMatch) {
        if (url.search(`https://twitter.com/i/api/graphql/.+/${routeMatch}`) === 0) {
            xhr[hookedIdentifier] = true;
            overrideResponse(xhr, timelineType);

            return true;
        }

        return false;
    }

    const xmlOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
        if (!this[hookedIdentifier] && args.length >= 2) {
            overrideAPIRoute(this, args[1], TimelineType.HOME, "Home(?:Latest)?Timeline") ||     // home
                overrideAPIRoute(this, args[1], TimelineType.REPLIES, "TweetDetail") ||          // replies
                overrideAPIRoute(this, args[1], TimelineType.SEARCH, "SearchTimeline") ||        // search
                overrideAPIRoute(this, args[1], TimelineType.PROFILE, "User(?:Tweets|Media)") || // profile
                overrideAPIRoute(this, args[1], TimelineType.CONNECT, "ConnectTabTimeline")      // connect
        }

        xmlOpen.apply(this, args);
    };

    console.info("Twitter Unverified is ready - with ❤️ from Xarvex");
})();
