"use strict";

const hideBlueReply = (article) => {
    const verifiedAccount = article?.querySelector("[aria-label='Verified account']");
    if (verifiedAccount) {
        let hideButton = article.previousElementSibling;
        if (!hideButton?.classList.contains("hide-blue-reply")) {
            hideButton = document.createElement("button");
            hideButton.classList.add("hide-blue-reply");
            hideButton.innerText = "Show Blue reply";
            hideButton.onclick = () => {
                article.style.display = "";
                hideButton.style.display = "none";
            };
            article.parentElement.insertBefore(hideButton, article);
            article.style.display = "none";
        }
    }
};

let conversation = document.querySelector("div[aria-label='Timeline: Conversation']");
const hideBlueReplies = () => {
    const articles = Array.from(conversation.querySelectorAll("article[data-testid='tweet']"));

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        if (!article?.parentElement.querySelector("div[role='progressbar']"))
            hideBlueReply(articles[i]);
    }

    // watch conversation for updates
    new MutationObserver((changes) => {
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            for (let i = 0; i < change.addedNodes.length; i++) {
                const node = change.addedNodes[i];
                if (node instanceof HTMLElement) {
                    const article = node.closest("article[data-testid='tweet']");
                    // don't hide OP
                    if (!article?.parentElement.querySelector("div[role='progressbar']"))
                        hideBlueReply(article);
                }
            }
        }
    }).observe(conversation, { childList: true, subtree: true });

};

if (conversation)
    hideBlueReplies();
else {
    // watch document for conversation to populate
    new MutationObserver((changes) => {
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            for (let i = 0; i < change.addedNodes.length; i++) {
                const node = change.addedNodes[i];
                if (node instanceof HTMLElement) {
                    conversation = node.querySelector("div[aria-label='Timeline: Conversation']");
                    if (conversation)
                        hideBlueReplies();
                }
            }
        }
    }).observe(document, { childList: true, subtree: true });
}
