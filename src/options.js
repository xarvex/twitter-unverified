"use strict";

function toCamel(str) {
    return str.toLowerCase().replace(/(\-\w)/g, function(group) {
        return group[1].toUpperCase();
    });
}

class Options {
    inputs = new Map();
    constructor(userOptions) {
        this.entries = Object.assign({}, userOptions);
    }
    attachInput(idOrInput, property) {
        const input = typeof idOrInput === "string" ? document.getElementById(idOrInput) : idOrInput;
        if (property == null)
            property = toCamel(input.id);
        this.inputs.set(property, input);
        if (input.type === "checkbox")
            input.checked = this.entries[property];
        else
            input.value = this.entries[property].toString();
        return input;
    }
    attachInputs(idsOrInputs) {
        for (let i = 0; i < idsOrInputs.length; i++)
            this.attachInput(idsOrInputs[i]);
    }
    sync() {
        for (const [property, input] of this.inputs)
            this.entries[property] = input.type === "checkbox" ? input.checked :
                input.classList.contains("numeric") ? parseInt(input.value) : input.value;
        return browser.storage.sync.set({ options: this.entries });
    }
};
Options.load = async function() {
    return new Options((await browser.storage.sync.get("options")).options);
};

document.addEventListener("DOMContentLoaded", async function() {
    const options = await Options.load();

    options.attachInputs([
        "handle-home",
        "handle-replies",
        "handle-search",
        "handle-profile",
        "handle-followers",
        "handle-following",
        "handle-connect",

        "blue-hard-hide",
        "blue-follower-threshold",

        "business-hard-hide",
        "business-follower-threshold",

        "remove-premium-ads",
        "remove-grok",
        "remove-subscriptions",
        "remove-affiliates",

        "log-actions"
    ]);

    const blueTargetInput = options.attachInput("blue-target");
    const businessTargetInput = options.attachInput("business-target");

    const blueInnerInputs = document.getElementById("blue-inner").getElementsByTagName("input");
    const businessInnerInputs = document.getElementById("business-inner").getElementsByTagName("input");
    for (let i = 0; i < blueInnerInputs.length; i++)
        blueInnerInputs.item(i).disabled = !blueTargetInput.checked;
    for (let i = 0; i < businessInnerInputs.length; i++)
        businessInnerInputs.item(i).disabled = !businessTargetInput.checked;
    blueTargetInput.addEventListener("change", function(e) {
        for (let i = 0; i < blueInnerInputs.length; i++)
            blueInnerInputs.item(i).disabled = !e.currentTarget.checked;
    });
    businessTargetInput.addEventListener("change", function(e) {
        for (let i = 0; i < businessInnerInputs.length; i++)
            businessInnerInputs.item(i).disabled = !e.currentTarget.checked;
    });

    document.getElementById("options").addEventListener("submit", function(e) {
        e.preventDefault();
        options.sync();
    });
});
