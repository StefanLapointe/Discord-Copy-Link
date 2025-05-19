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
    //   containing the link in its src attribute as its previous sibling.
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
        
        // Handle videos and sometimes GIFs and download buttons.
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
    alert(menu + " " + link)
}
