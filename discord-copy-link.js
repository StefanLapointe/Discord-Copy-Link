"use strict";

// This is the only element that is at the same time high enough on the DOM tree
// to always be present and low enough on the DOM tree to receive contextmenu
// events through event bubbling.
const appMount = document.getElementById("app-mount");

appMount.addEventListener("contextmenu", async event => {
    // If the event didn't come from a message, do nothing.
    // Messages are marked by the attribute role="article".
    let message = event.target.closest("[role=\"article\"]");
    if (!message) return;
    
    // If there is no link to inject, do nothing.
    let link = getLink(event.target);
    if (!link) return;

    // Inject the link into the context menu.
    // For whatever reason the context menu's id will be "message".
    let menu = await waitForElementById("message");
    injectOptions(menu, link);
});

function getLink(target) {
    // The element should have a message as an ancestor in order for its link
    // to be copied. Messages are marked with a "role" attribute of "article".
    if (!target.closest("[role=\"article\"]")) return null;

    // There are a number of different cases to consider when obtaining a link
    // from an event target:
    // - Images: The event target will be an <a> tag with the link in its href
    //   attribute.
    // - Videos: The event target will be a <div> tag with a <video> tag
    //   containing the link in its src attribute as its previous sibling if the
    //   video has not been played, or the <video> tag itself if the video is
    //   playing, paused, or finished.
    // - GIFs: The event target will be like that of an image, unless you
    //   right-click on the "Add to Favorites" button, in which case the event
    //   target can be the button itself or any of its descendants and the link
    //   is contained in the href attribute of the <a> tag which will be the
    //   "great uncle" of the button.
    // - Hyperlinks: The event target will be a <span> tag within an <a> tag
    //   with the link contained in the href attribute of the <a> tag.
    // - Files: The event target will be an <a> tag with the link in its href
    //   attribute.
    // - Download buttons: The event target will be an <a> tag with the link in
    //   its href attribute or any descendant of that <a> tag.
    switch (target.tagName.toLowerCase()) {
        // Handle images, files, and sometimes GIFs and download buttons.
        case "a":
            return target.getAttribute("href");
        
        // Handle emojis.
        case "img":
            // This is nessary to distinguish emojis from profile pictures.
            if (target.getAttribute("data-type") != "emoji") return null;
            return target.getAttribute("src");
        
        // Handle hyperlinks.
        case "span":
            return target.parentElement.getAttribute("href");
        
        // Sometimes handle videos.
        case "video":
            return target.getAttribute("src");
        
        // Sometimes handle videos, GIFs, and download buttons.
        default:
            // The contextmenu event has the sibling of the video as target.
            let maybeVideo = target.previousElementSibling;
            if (maybeVideo) return maybeVideo.getAttribute("src");
            
            // This handles certain download button cases as well as the case
            // where the target is part of the "Add to Favourites" button that
            // appears on GIFs.
            let maybeButton = target.closest("[role=\"button\"]");
            if (!maybeButton) return null;
            let buttonGrandparent = maybeButton.parentElement.parentElement;
            let maybeA = buttonGrandparent.querySelector("a");
            if (!maybeA) return null;
            return maybeA.getAttribute("href");
    }
}

function waitForElementById(id) {
    return new Promise((resolve, reject) => {
        let observer = new MutationObserver((records, observer) => {
            let element = document.getElementById(id);
            if (element) {
                resolve(element);
                observer.disconnect();
            }
        });
        observer.observe(document, {
            subtree: true,
            childList: true
        });
        
        // In case the desired element came into existence before observation.
        let element = document.getElementById(id);
        if (element) {
            resolve(element);
            observer.disconnect();
        }
    })
}

function injectOptions(menu, link) {
    // The menu has one child, a "scroller", which contains groups of meny items
    // and separators as children.
    let scroller = menu.firstElementChild;

    // Normally the last menu item in the context menu is "Delete Message" or
    // "Report Message", depending on whether or not the user sent the message.
    // If "Developer Mode", then an additional group of menu items is added,
    // containing just one menu item, "Copy Message ID". On the desktop app,
    // the group containing "Copy Link" and "Open Link" and the group containing
    // "Copy Image" and "Open Image" appear where applicable, in that order,
    // between the "Delete Message" or "Report Message" menu item group and the
    // "Copy Message ID" menu item group when in "Developer Mode", or just at
    // the end otherwise. Thus, the simplest solution is to obtain the menu item
    // group containing "Delete Message" or "Report Message" and then append
    // things after that.
    let deleteMessage = document.getElementById("message-delete");
    let reportMessage = document.getElementById("message-report");
    let previousGroup = (deleteMessage || reportMessage).parentElement;

    // Clone a separator to add to the scroller.
    let separator = scroller.querySelector("[role=\"separator\"]").cloneNode();

    // Obtain an arbitrary menu item to use to construct the new menu items.
    // Note that its event listeners will not be preserved by cloning.
    let markUnread = document.getElementById("message-mark-unread");
    let arbitraryMenuItem = markUnread.cloneNode(true);
    
    // Remove the SVG image from the cloned menu item.
    arbitraryMenuItem.lastElementChild.remove();

    // Construct the "Copy Link" menu item.
    let copyLink = arbitraryMenuItem.cloneNode(true);
    copyLink.firstElementChild.innerText = "Copy Link";
    copyLink.id = "copy-link";
    copyLink.addEventListener("click", () => {
        navigator.clipboard.writeText(link);
        
        // Click on the "click trap" to cause the menu to close.
        menu.parentElement.parentElement.click();
    });

    // Construct the "Open Link" menu item.
    let openLink = arbitraryMenuItem.cloneNode(true);
    openLink.firstElementChild.innerText = "Open Link";
    openLink.id = "open-link";
    openLink.addEventListener("click", () => {
        window.open(link);

        // Click on the "click trap" to cause the menu to close.
        menu.parentElement.parentElement.click();
    });

    // The "focused" appearance of menu items is controlled by dynamically
    // adding or removing a certain class name of the form "focussed_suffix"
    // where "suffix" is a sequence of letters and numbers common across a group
    // of different class names. Event listeners are not preserved during
    // cloning so it is necessary to manually recreate the expected behaviour.
    let suffix = arbitraryMenuItem.classList.item(0).split("_")[1];
    let focused = "focused_" + suffix;
    let onmouseenter = (event) => {
        event.target.classList.add(focused);
    };
    copyLink.addEventListener("mouseenter", onmouseenter);
    openLink.addEventListener("mouseenter", onmouseenter);
    menu.addEventListener("mouseleave", (event) => {
        for (let element of scroller.querySelectorAll("." + focused)) {
            element.classList.remove(focused);
        }
    })
    let layerContainer = menu.parentElement.parentElement.parentElement;
    let observer = new MutationObserver((records, observer) => {
        if (!document.getElementById("message")) {
            observer.disconnect();
            return;
        }
        for (let record of records) {
            if (record.target.classList.contains(focused)) {
                for (let element of scroller.querySelectorAll("." + focused)) {
                    if (element != record.target) {
                        console.log("unfocusing " + element.id);
                        element.classList.remove(focused);
                    }
                }
            }
        }
    });
    observer.observe(layerContainer, {
        subtree: true,
        attributeFilter: ["class"]
    });

    // Construct the new menu item group.
    let group = document.createElement("div");
    group.setAttribute("role", "group");
    group.replaceChildren(copyLink, openLink);

    // Insert the new separator and menu item group.
    previousGroup.after(separator, group);

    // Fix menu positioning so the bottom is not cut off.
    if (menu.getBoundingClientRect().bottom > window.innerHeight) {
        menu.style.position = "fixed";
        menu.style.bottom = "0";
    }
}
