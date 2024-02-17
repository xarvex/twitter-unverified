"use strict";

// define function and run immediately to keep scope
(function() {
    let options = {};
    window.addEventListener("xarvex/twitter-unverified/SettingsUpdate", function(event) {
        options = event.detail;
    });

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
            this.affiliated = affiliated === "BusinessLabel" || affiliated === "business_label" ? "Business" : affiliated;
        } shouldHide() {
            if (!this.followed && !window.location.pathname.startsWith(`/${this.handle}`)) {
                if (this.verificationType === "Business") {
                    if (options.businessTarget &&
                        (options.businessFollowerThreshold === -1 ||
                            this.followers > options.businessFollowerThreshold))
                        return UserFactor.BUSINESS;
                }
                else if (this.blue && options.blueTarget &&
                    (options.blueFollowerThreshold === -1 ||
                        this.followers > options.blueFollowerThreshold))
                    return UserFactor.BLUE;
            }

            return null;
        }
        markHidden(factor) {
            if (options.logActions)
                console.debug(`Hidden @${this.handle} (Twitter ${factor.description} - ${this.followers} followers)`);
            window.dispatchEvent(new CustomEvent("xarvex/twitter-unverified/UserHidden", { detail: this }));
        }
    }
    TwitterUser.fromData = function(userData) {
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
    TwitterUser.fromPost = function(resultData) {
        // post will not have a user if it is of type "TextTombstone" (account deleted)
        const userData = resultData["result"]?.["core"]?.["user_results"]?.["result"];
        return userData != null ? TwitterUser.fromData(userData) : null;
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

        const factor = user?.shouldHide();
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

    function handleTimelineUser(timelineUserData) {
        const user = TwitterUser.fromData(timelineUserData["user_results"]["result"]);

        const factor = user.shouldHide();
        if (factor != null) {
            // no true "hiding" mechanism exists, must remove
            timelineUserData["user_results"]["result"]["__typename"] = "";
            user.markHidden(factor);
        }
    }

    const APIType = {
        HOME: Symbol(),
        REPLIES: Symbol(),
        SEARCH: Symbol(),
        PROFILE: Symbol(),
        PROFILE_FOLLOWERS: Symbol(),
        PROFILE_FOLLOWING: Symbol(),
        PROFILE_OTHER: Symbol(),
        CONNECT: Symbol(),
        USER_RECOMMENDATIONS: Symbol()
    };

    function isTimelinePost(contentData) {
        return contentData["__typename"] === "TimelineTweet" &&
            contentData["tweet_results"]?.["result"]?.["__typename"] === "Tweet";
    }

    function isTimelineUser(contentData) {
        return contentData["__typename"] === "TimelineUser" &&
            contentData["user_results"]?.["result"]?.["__typename"] === "User";
    }

    function handleInstructionEntry(entry) {
        switch (entry["entryType"]) {
            case "TimelineTimelineItem": // post
                const timelineItemData = entry["itemContent"];
                if (isTimelinePost(timelineItemData))
                    handlePost(timelineItemData["tweet_results"]);
                else if (isTimelineUser(timelineItemData))
                    handleTimelineUser(timelineItemData);
                break;
            case "TimelineTimelineModule": // thread
                const timelineItemsData = entry["items"];
                for (let k = 0; k < timelineItemsData.length; k++) {
                    const timelineItemData = timelineItemsData[k]["item"]["itemContent"];
                    if (isTimelinePost(timelineItemData))
                        handlePost(timelineItemData["tweet_results"]);
                    else if (isTimelineUser(timelineItemData))
                        handleTimelineUser(timelineItemData);
                }
                break
        }
    }

    // do not reassign data, so value can be modified and returned
    function parseAPIData(data, type) {
        let instructions;
        switch (type) {
            case APIType.HOME:
                if (options.handleHome)
                    instructions = data["data"]["home"]["home_timeline_urt"]["instructions"];
                break;
            case APIType.REPLIES:
                if (options.handleReplies)
                    instructions = data["data"]["threaded_conversation_with_injections_v2"]["instructions"];
                break;
            case APIType.SEARCH:
                if (options.handleSearch)
                    instructions = data["data"]["search_by_raw_query"]["search_timeline"]["timeline"]["instructions"];
                break;
            case APIType.PROFILE:
                if (options.handleProfile)
                    instructions = data["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"];
                break;
            case APIType.CONNECT:
                if (options.handleConnect)
                    instructions = data["data"]["connect_tab_timeline"]["timeline"]["instructions"];
                break;
            case APIType.PROFILE_FOLLOWERS:
            case APIType.PROFILE_FOLLOWING:
            case APIType.PROFILE_OTHER:
                let run = false;
                switch (type) {
                    case APIType.PROFILE_FOLLOWERS:
                        run = options.handleFollowers;
                        break;
                    case APIType.PROFILE_FOLLOWING:
                        run = options.handleFollowing;
                        break;
                    case APIType.PROFILE_OTHER:
                        run = options.handleProfile;
                        break;
                }
                if (run)
                    instructions = data["data"]["user"]["result"]["timeline"]["timeline"]["instructions"];
                break;
            case APIType.USER_RECOMMENDATIONS:
                // reversed due to deletion of elements, would repeat otherwise
                for (let i = data.length - 1; i >= 0; i--) {
                    const userData = data[i]["user"];
                    const user = new TwitterUser(
                        userData["id_str"],
                        userData["screen_name"],
                        userData["name"],
                        userData["followers_count"],
                        userData["following"],
                        userData["blocking"],
                        userData["ext_is_blue_verified"],
                        userData["ext_verified_type"],
                        userData["ext_highlighted_label"]?.["user_label_type"]
                    );

                    const factor = user.shouldHide();
                    if (factor != null) {
                        data.splice(i, 1);
                        user.markHidden(factor);
                    }
                }
                break;
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

    function overrideResponse(xhr, apiType) {
        function override() {
            Object.defineProperty(xhr, "responseText", {
                get: function() {
                    delete xhr.responseText;
                    const original = xhr.responseText;

                    let responseText = original;
                    try {
                        responseText = JSON.stringify(parseAPIData(JSON.parse(responseText), apiType));
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

    function overrideAPIRoute(xhr, url, apiType, routeMatch, apiMatch = "graphql/.+") {
        if (url.search(`https://(?:twitter.com/i/api|api.twitter.com)/${apiMatch}/${routeMatch}`) === 0) {
            xhr[hookedIdentifier] = true;
            overrideResponse(xhr, apiType);

            return true;
        }

        return false;
    }

    const xmlOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
        if (!this[hookedIdentifier] && args.length >= 2) {
            overrideAPIRoute(this, args[1], APIType.HOME, "Home(?:Latest)?Timeline") ||
                overrideAPIRoute(this, args[1], APIType.REPLIES, "TweetDetail") ||
                overrideAPIRoute(this, args[1], APIType.SEARCH, "SearchTimeline") ||
                overrideAPIRoute(this, args[1], APIType.PROFILE, "User(?:Tweets|Media)") ||
                overrideAPIRoute(this, args[1], APIType.PROFILE_FOLLOWERS, "(?:(?:BlueVerified)?Followers)") ||
                overrideAPIRoute(this, args[1], APIType.PROFILE_FOLLOWING, "Following") ||
                overrideAPIRoute(this, args[1], APIType.PROFILE_OTHER, "(?:UserHighlightsTweets|UserBusinessProfileTeamTimeline)") ||
                overrideAPIRoute(this, args[1], APIType.CONNECT, "ConnectTabTimeline") ||
                overrideAPIRoute(this, args[1], APIType.USER_RECOMMENDATIONS, "users/recommendations\.json", "1\.1")
        }

        xmlOpen.apply(this, args);
    };

    console.info("Twitter Unverified is ready - with ❤️ from Xarvex");
})();
