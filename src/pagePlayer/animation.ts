// Defines the extra fields we expect to find in the dataset of an HTMLElement
// that has animation specified (to make TypeScript and TSLint happy).
interface IAnimation { initialrect: string;  finalrect: string; }

export default class Animation {

    public static documentHasAnimation(): boolean {
        return !!Animation.getAnimationView(document.body);
    }

    public static getAnimationView(parent: HTMLElement): HTMLElement {
        return <HTMLElement> ([].slice.call(parent.getElementsByClassName("bloom-imageContainer"))
            .find(v => (<IAnimation> v.dataset).initialrect));
    }

    private  currentPage: HTMLElement;
    private  lastDurationPage: HTMLElement;
    private animationView: HTMLElement;
    private permanentRuleCount: number; // rules from initial creation of stylesheet
    // incremented for each animated div, to keep animation rules for each one distinct
    private ruleModifier: number = 0;
    private wrapperClassName = "bloom-ui-animationWrapper";
    private animationDuration: number = 3000;
    private fadePageTransitionMilliseconds: number = 100;
    private shouldAnimateInAllOrientations: boolean = false;

    constructor() {
        // 200 is designed to make sure this happens AFTER we adjust the scale.
        // Note that if we are not currently animating, this.currentPage may be null or
        // obsolete. It is only used if we need to turn OFF the animation.
        window.addEventListener("orientationchange", () => window.setTimeout(
            () => this.adjustWrapDiv(this.currentPage), 200));
    }

    public HandlePageBeforeVisible(page: HTMLElement) {
        if (this.shouldAnimate(page)) {
            this.setupAnimation(page, true);
        } else {
            // may have left-over wrappers from when page previously played.
            this.removeAnimationWrappers(page);
        }
    }

    public HandlePageVisible(page: HTMLElement) {
        if (this.shouldAnimate(page)) {
            this.pageVisible(page);
        }
    }

    public HandlePageDurationAvailable(page: HTMLElement, duration: number) {
        if (this.shouldAnimate(page)) {
            this.animationDuration = duration;
            this.durationAvailable(page);
        }
    }

    public setShouldAnimateInAllOrientations() {
        this.shouldAnimateInAllOrientations = true;
    }

    // Only applicable to resuming paused animation (by removing the pause CSS rule)
    public PlayAnimation() {
        const stylesheet = this.getAnimationStylesheet().sheet;
        (<CSSStyleSheet> stylesheet).removeRule((<CSSStyleSheet> stylesheet).cssRules.length - 1);
        this.permanentRuleCount--;
    }

    public PauseAnimation() {
        const stylesheet = this.getAnimationStylesheet().sheet;
        (<CSSStyleSheet> stylesheet).insertRule(
            ".bloom-animate {animation-play-state: paused; -webkit-animation-play-state: paused}",
            (<CSSStyleSheet> stylesheet).cssRules.length);
        this.permanentRuleCount++; // not really permanent, but not to be messed with.    
    }

    public SetFadePageTransitionMilliseconds(duration: number) {
        this.fadePageTransitionMilliseconds = duration;
    }

    public setupAnimation(page: HTMLElement, beforeVisible: boolean): void {
        this.animationView = Animation.getAnimationView(page);
        if (!this.animationView) {return; } // no image to animate

        // We expect to see something like this:
        // <div class="bloom-imageContainer bloom-backgroundImage bloom-leadingElement"
        // style="background-image:url('1.jpg')"
        // title="..."
        // data-initialrect="0.3615 0.0977 0.6120 0.6149" data-finalrect="0.0000 0.0800 0.7495 0.7526"
        // data-duration="5" />
        // ...
        // </div>
        //
        // We want to make something like this:
        // <div ...with all the original properties minus the background-image style>
        //      <div class="bloom-ui-animationWrapper" style = "width: 400px; height; 100%">
        //          <div class="bloom-animate bloom-animateN" style="background-image:url('1.jpg');
        //               width: 400px; height; 300px"/>
        //              ...original content...
        //          </div>
        //      </div>
        // </div>
        // Assign each animation div a unique number so their rules are distinct.
        let ruleMod = this.animationView.getAttribute("data-animationNumber");
        if (!ruleMod) {
            ruleMod = "" + this.ruleModifier++;
            this.animationView.setAttribute("data-animationNumber", ruleMod);
        }
        const animateStyleName = "bloom-animate" + ruleMod;
        const movePicName = "movepic" + ruleMod;

        let wrapDiv: HTMLElement = null;

        if (this.animationView.children.length !== 1
            || !this.hasClass(<HTMLElement> this.animationView.firstChild, this.wrapperClassName)) {

            wrapDiv = document.createElement("div");
            this.addClass(wrapDiv, this.wrapperClassName);
            const movingDiv = document.createElement("div");
            wrapDiv.appendChild(movingDiv);
            // hide it until we can set its size and the transform rule for its child properly.
            wrapDiv.setAttribute("style", "visibility: hidden;");

            const styleData = this.animationView.getAttribute("style");
            if (styleData) {
                // This somewhat assumes the ONLY style attribute is the background image.
                // I think we can improve that when and if it becomes an issue.
                this.animationView.setAttribute("style", "");
                movingDiv.setAttribute("style", styleData);
                const imageSrc = styleData.replace(/.*url\((['"])([^)]*)\1\).*/i, "$2");
                const image = new Image();
                image.addEventListener("load", () => {
                    if (image.height) {  // some browsers may not produce this?
                        wrapDiv.setAttribute("data-aspectRatio", (image.width / image.height).toString());
                    } else {
                        // can't get accurate size for some reason, use fall-back.
                        wrapDiv.setAttribute("data-aspectRatio", (4 / 3).toString());
                    }
                    this.updateWrapDivSize(wrapDiv);
                    this.insertAnimationRules(page, wrapDiv, animateStyleName, movePicName, beforeVisible);
                    const oldStyle = wrapDiv.getAttribute("style");
                     // now we can show it.
                    wrapDiv.setAttribute("style", oldStyle.substring("visibility: hidden; ".length));
                });
                // trigger loading the image (which is not used except for the code above that listens for
                // it to be loaded).
                image.src = imageSrc;
            } else {
                // Enhance: if the original div had content (typically an <img>), 
                // try to use its image to figure aspect ratio.
                // For now, just set a default.
                wrapDiv.setAttribute("data-aspectRatio", (4 / 3).toString());
            }

            // Give this rule the class bloom-animate to trigger the rule created in getAnimationStylesheet,
            // and bloom-animationN to trigger the one we are about to create for page-specific animation.
            movingDiv.setAttribute("class", "bloom-animate " + animateStyleName);
            // If the animation view had children (typically it has none, just shows a background image),
            // move them to the inner div
            while (this.animationView.childNodes.length) {
                movingDiv.appendChild(this.animationView.childNodes[0]);
            }
            this.animationView.appendChild(wrapDiv);
        } else {
            wrapDiv = <HTMLElement> this.animationView.children.item(0);
        }

        // console.log(initialTransform);
        // console.log(finalTransform);
        if (wrapDiv.getAttribute("data-aspectRatio")) {
            // if we have the wrap div and have already determined its aspect ratio,
            // it might still be wrongly positioned if we changed orientation
            // since it was computed.
            this.updateWrapDivSize(wrapDiv);
            this.insertAnimationRules(page, wrapDiv, animateStyleName, movePicName, beforeVisible);
        }
        // if we ARE waiting for the wrap div aspect ratio, everything gets updated when we get it.
    }

    // We cannot be absolutely sure whether the page transition or collecting the audio lengths will
    // take longer. So we listen for both events and start the animation when we have both have
    // occurred.
    public  durationAvailable(page: HTMLElement) {
        this.lastDurationPage = page;
        if (this.currentPage === this.lastDurationPage) {
            // already got the corresponding pageVisible event
            this.setupAnimation(page, false);
        }
    }

    public pageVisible(page: HTMLElement) {
        this.currentPage = page;
        if (this.currentPage === this.lastDurationPage) {
            // already got the corresponding durationAvailable event
            this.setupAnimation(page, false);
        }
    }

    // insert the rules that animate the image (or set its state during the page turn animation).
    // We hope a call with beforeVisible false happens before the image is visible,
    // but we can't do it until we get the aspect
    // ratio of the image and use it to compute the size of the wrapDiv.
    private insertAnimationRules(page: HTMLElement, wrapDiv: HTMLElement,
                                 animateStyleName: string, movePicName: string, beforeVisible: boolean) {
        // Figure out the transforms needed to bring about the animation. These are relative to the size of the
        // wrapDiv which clips the animation, so we can't compute it until we set that size, which in turn
        // sometimes has to wait until we get the aspect ratio of the image.
        const stylesheet = this.getAnimationStylesheet().sheet;
        const initialRectStr = (<IAnimation> <any> this.animationView.dataset).initialrect;

        //Fetch the data from the dataset and reformat into scale width and height along with offset x and y
        const initialRect = initialRectStr.split(" ");
        const initialScaleWidth = 1 / parseFloat(initialRect[2]);
        const initialScaleHeight = 1 / parseFloat(initialRect[3]);
        const finalRect = (<IAnimation> <any> this.animationView.dataset).finalrect.split(" ");
        const finalScaleWidth = 1 / parseFloat(finalRect[2]);
        const finalScaleHeight = 1 / parseFloat(finalRect[3]);

        // remove obsolete rules. We want to keep the permanent rules and the ones for the previous page
        // (which may still be visible). That's at most 2. It's harmless to keep an extra one.
        while ((<CSSStyleSheet> stylesheet).cssRules.length > this.permanentRuleCount + 4) {
            // remove the last (oldest, since we add at start) non-permanent rule
            (<CSSStyleSheet> stylesheet).removeRule((<CSSStyleSheet> stylesheet).cssRules.length
                - this.permanentRuleCount - 1);
        }
        const wrapDivWidth = wrapDiv.clientWidth;
        const wrapDivHeight = wrapDiv.clientHeight;
        const initialX = parseFloat(initialRect[0]) * wrapDivWidth;
        const initialY = parseFloat(initialRect[1]) * wrapDivHeight;
        const finalX = parseFloat(finalRect[0]) * wrapDivWidth;
        const finalY = parseFloat(finalRect[1]) * wrapDivHeight;

        // Will take the form of "scale3d(W, H,1.0) translate3d(Xpx, Ypx, 0px)"
        // Using 3d scale and transform apparently causes GPU to be used and improves
        // performance over scale/transform. (https://www.kirupa.com/html5/ken_burns_effect_css.htm)
        // May also help with blurring of material originally hidden.
        const initialTransform = "scale3d(" + initialScaleWidth + ", " + initialScaleHeight
            + ", 1.0) translate3d(-" + initialX + "px, -" + initialY + "px, 0px)";
        const finalTransform = "scale3d(" + finalScaleWidth + ", " + finalScaleHeight
            + ", 1.0) translate3d(-" + finalX + "px, -" + finalY + "px, 0px)";
        if (page !== this.currentPage || page !== this.lastDurationPage || beforeVisible) {
            // We aren't ready to start the animation, either because we haven't yet
            // been told the duration of this page, or we haven't yet been told to treat
            // it as visible.
            // remove any previous rules (used-up ones from a previous animation of this page)
            for (let i = 0; i < (<CSSStyleSheet> stylesheet).cssRules.length; i++) {
                if ((<CSSStyleRule> (<CSSStyleSheet> stylesheet).cssRules[i]).selectorText ===
                    "." + animateStyleName) {
                        (<CSSStyleSheet> stylesheet).removeRule(i);
                        break;
                }
            }
            for (let i = 0; i < (<CSSStyleSheet> stylesheet).cssRules.length; i++) {
                if ((<CSSStyleRule> (<CSSStyleSheet> stylesheet).cssRules[i]).selectorText ===
                    "." + movePicName) {
                        (<CSSStyleSheet> stylesheet).removeRule(i);
                        break;
                }
            }
            // this rule puts it in the initial state for the animation, so we get a smooth
            // transition when the animation starts. Don't start THIS animation, though,
            // until the page-turn one completes (or, for android, till we get the signal to start).
            (<CSSStyleSheet> stylesheet).insertRule("." + animateStyleName
                + " { transform-origin: 0px 0px; transform: "
                + initialTransform + ";}", 0);
        } else {
            let beforeVisibleRule: number = -1;
            // Find any existing rule for this frame (typically the one inserted by beforeVisible).
            // We will remove this later (but not before we add the animation rules, lest we get
            // a flash of full-size image.
            for (let i = 0; i < (<CSSStyleSheet> stylesheet).cssRules.length; i++) {
                if ((<CSSStyleRule> (<CSSStyleSheet> stylesheet).cssRules[i]).selectorText ===
                    "." + animateStyleName) {
                    beforeVisibleRule = i;
                    break;
                }
            }

            //Insert the keyframe animation rule with the dynamic begin and end set
            (<CSSStyleSheet> stylesheet).insertRule("@keyframes " + movePicName
                + " { from{ transform-origin: 0px 0px; transform: " + initialTransform
                + "; } to{ transform-origin: 0px 0px; transform: " + finalTransform + "; } }", 0);

            //Insert the css for the imageView div that utilizes the newly created animation
            // We make the animation longer than the narration by the transition time so
            // the old animation continues during the fade.
            (<CSSStyleSheet> stylesheet).insertRule("." + animateStyleName
                + " { transform-origin: 0px 0px; transform: "
                + initialTransform
                + "; animation-name: " + movePicName + "; animation-duration: "
                + (this.animationDuration + this.fadePageTransitionMilliseconds / 1000)
                + "s; animation-fill-mode: forwards; "
                + "animation-timing-function: linear;}", 1);
            // Remove the rule we located earlier, if any. Index is increased because we inserted
            // the new rules before it.
            if (beforeVisibleRule >= 0) {
                (<CSSStyleSheet> stylesheet).removeRule(beforeVisibleRule + 2);
            }
        }
    }

    private updateWrapDivSize(wrapDiv: HTMLElement) {
        const imageAspectRatio = parseFloat(wrapDiv.getAttribute("data-aspectRatio"));
        const viewWidth = this.animationView.clientWidth; // getBoundingClientRect().width;
        const viewHeight = this.animationView.clientHeight; // getBoundingClientRect().height;
        const viewAspectRatio = viewWidth / viewHeight;
        let oldStyle = wrapDiv.getAttribute("style"); // may have visibility: hidden, which we need.
        // If it has anything else (e.g., dimensions for a different orientation), remove them.
        if (oldStyle.substring(0, "visibility: hidden;".length) === "visibility: hidden;") {
            oldStyle = "visibility: hidden;";
        } else {
            oldStyle = "";
        }
        if (imageAspectRatio < viewAspectRatio) {
            // black bars on side
            const imageWidth = viewHeight * imageAspectRatio;
            wrapDiv.setAttribute("style", oldStyle + " height: 100%; width: " + imageWidth
                + "px; left: " + (viewWidth - imageWidth) / 2  + "px");
        } else {
            // black bars top and bottom
            const imageHeight = viewWidth / imageAspectRatio;
            wrapDiv.setAttribute("style", oldStyle + " width: 100%; height: " + imageHeight
                + "px; top: " + (viewHeight - imageHeight) / 2  + "px");
        }
    }

    // Adjust the wrap div for a change of orientation. The name is slightly obsolete
    // since currently we don't continue the animation if we change to portrait mode,
    // where animation is disabled. And if we change to landscape mode, we don't try
    // to start up the animation in the middle of the narration. So all it really
    // has to do currently is REMOVE the animation stuff if changing to portrait.
    // However, since everything else is built around shouldAnimatePage, it seemed
    // worth keeping the logic that adjusts things if we ever go from one animated
    // orientation to another. Note, however, that the 'page' argument passed is not
    // currently valid if turning ON animation. Thus, we will need to do more to get
    // the right page if we want to turn animation ON while switching to horizontal.
    private adjustWrapDiv(page: HTMLElement): void {
        if (!page) {
            return;
        }
        if (!this.shouldAnimate(page)) {
            // we may have a left-over wrapDiv from animating in the other orientation,
            // which could confuse things.
            this.removeAnimationWrappers(page);
            return;
        }
        // Nothing to do if we don't have a wrap div currently.
        const wrapDiv = this.getWrapDiv(page);
        if (!wrapDiv) {
            return;
        }
        this.updateWrapDivSize(wrapDiv);
    }

    private getWrapDiv(page: HTMLElement): HTMLElement {
        if (!page) {
            return null;
        }
        const animationDiv = Animation.getAnimationView(page);
        if ((!animationDiv) || animationDiv.children.length !== 1) {
            return null;
        }
        const wrapDiv = <HTMLElement> animationDiv.firstElementChild;
        if (!this.hasClass(wrapDiv, this.wrapperClassName)) {
            return null;
        }
        return wrapDiv;
    }

    private removeAnimationWrappers(page: HTMLElement) {
        const wrapDiv = this.getWrapDiv(page);
        if (!wrapDiv) {
            return;
        }
        const movingDiv = wrapDiv.firstElementChild;
        const parent = wrapDiv.parentElement;
        parent.setAttribute("style", movingDiv.getAttribute("style"));
        while (movingDiv.childNodes.length) {
            parent.appendChild(this.animationView.childNodes[0]);
        }
        parent.removeChild(wrapDiv);
    }

    private  addClass(elt: HTMLElement, className: string) {
        const index = elt.className.indexOf(className);
        if (index < 0) {
            elt.className = elt.className + " " + className;
        }
    }

    // private  removeClass(elt: Element, className: string) {
    //     const index = elt.className.indexOf(className);
    //     if (index >= 0) {
    //         elt.className = elt.className.slice(0, index)
    //             + elt.className.slice(index + className.length, elt.className.length);
    //     }
    // }

    // a crude check good enough for the long class names we care about here.
    private  hasClass(elt: Element, className: string) {
        if (!elt || !elt.className) {
            return false;
        }
        return elt.className.indexOf(className) >= 0;
    }

    private getAnimationStylesheet(): HTMLStyleElement {
        let animationElement = document.getElementById("animationSheet");
        if (!animationElement) {
            animationElement = document.createElement("style");
            animationElement.setAttribute("type", "text/css");
            animationElement.setAttribute("id", "animationSheet");
            animationElement.innerText = ".bloom-ui-animationWrapper {overflow: hidden; translateZ(0)} "
                + ".bloom-animate {height: 100%; width: 100%; "
                + "background-repeat: no-repeat; background-size: contain}";
            document.body.appendChild(animationElement);
            this.permanentRuleCount = 2; // (<CSSStyleSheet> <any> animationElement).cssRules.length;
        }
        return <HTMLStyleElement> animationElement;
    }

     private shouldAnimate(page: HTMLElement): boolean {
        return this.shouldAnimateInAllOrientations || page.classList.contains("Device16x9Landscape");
    }
}
