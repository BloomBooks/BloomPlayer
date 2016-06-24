import "./animation.less";
import {PageVisible, PageBeforeVisible, PageHidden} from "./navigation";
import {PageDuration, PageDurationAvailable} from "./narration";

export function SetupAnimation(): void {
    PageVisible.subscribe(page => {
        Animation.pageVisible(page);
    });
    PageBeforeVisible.subscribe(page => {
        Animation.setupAnimation(page, true);
    });
    PageHidden.subscribe(page => {
        // Anything to do here?
    });
    PageDurationAvailable.subscribe(page => {
        Animation.durationAvailable(page);
    });
}

// Defines the extra fields we expect to find in the dataset of an HTMLElement
// that has animation specified (to make TypeScript and TSLint happy).
interface IAnimation { initialrect: string;  finalrect: string; }

class Animation {
    public static setupAnimation(page: HTMLElement, beforeVisible: boolean): void {
        const animationView = <HTMLElement> ([].slice.call(page.getElementsByClassName("bloom-imageView"))
            .find(v => (<IAnimation> v.dataset).initialrect));
        if (!animationView) {return; } // no image to animate
        const stylesheet = this.getAnimationStylesheet().sheet;
        const initialRectStr = (<IAnimation> <any> animationView.dataset).initialrect;

        //Fetch the data from the dataset and reformat into scale width and height along with offset x and y
        const initialRect = initialRectStr.split(" ");
        const viewWidth = animationView.parentElement.getBoundingClientRect().width;
        const viewHeight = animationView.parentElement.getBoundingClientRect().height;
        const initialScaleWidth = viewWidth / parseFloat(initialRect[2]);
        const initialScaleHeight = viewHeight / parseFloat(initialRect[3]);
        const finalRect = (<IAnimation> <any> animationView.dataset).finalrect.split(" ");
        const finalScaleWidth = viewWidth / parseFloat(finalRect[2]);
        const finalScaleHeight = viewHeight / parseFloat(finalRect[3]);

        const initialX = parseFloat(initialRect[0]);
        const initialY = parseFloat(initialRect[1]);
        const finalX = parseFloat(finalRect[0]);
        const finalY = parseFloat(finalRect[1]);

        //Will take the form of "scale(W, H) translate(Xpx, Ypx)"
        const initialTransform = "scale(" + initialScaleWidth + ", " + initialScaleHeight
            + ") translate(" + initialX + "px, " + initialY + "px)";
        const finalTransform = "scale(" + finalScaleWidth + ", " + finalScaleHeight
            + ") translate(" + finalX + "px, " + finalY + "px)";

        console.log(initialTransform);
        console.log(finalTransform);
        while ((<CSSStyleSheet> stylesheet).cssRules.length > 1) {
            // remove rules from some previous picture
            (<CSSStyleSheet> stylesheet).removeRule(0);
        }

        if (beforeVisible) {
            // this rule should put it in the initial state. But the element's own width is different
            // in this pre-visible state so results are unpredictable. Better just hide it until things are right.
            // (Just making things invisible could be done with rather less calculation. Leaving it this way
            // in case we want to have another go at getting the initial state right while visible.)
            // (<CSSStyleSheet> stylesheet).insertRule(".bloom-animate { transform-origin: 0px 0px; transform: "
            //     + initialTransform + ";}", 0);
            (<CSSStyleSheet> stylesheet).insertRule(".bloom-animate {visibility: hidden;}", 0);
        } else {
            //Insert the keyframe animation rule with the dynamic begin and end set
            (<CSSStyleSheet> stylesheet).insertRule("@keyframes movepic { from{ transform-origin: 0px 0px; transform: "
                + initialTransform + "; } to{ transform-origin: 0px 0px; transform: " + finalTransform + "; } }", 0);

            //Insert the css for the imageView div that utilizes the newly created animation
            (<CSSStyleSheet> stylesheet).insertRule(".bloom-animate { transform-origin: 0px 0px; transform: "
                + initialTransform
                + "; animation-name: movepic; animation-duration: "
                + PageDuration + "s; animation-fill-mode: forwards; }", 1);
        }
        this.addClass(animationView, "bloom-animate"); // add the class that triggers the animation
    }

    // We cannot be absolutely sure whether the page transition or collecting the audio lengths will
    // take longer. So we listen for both events and start the animation when we have both have
    // occurred.
    public static durationAvailable(page: HTMLElement) {
        this.lastDurationPage = page;
        if (this.currentPage === this.lastDurationPage) {
            // already got the corresponding pageVisible event
            this.setupAnimation(page, false);
        }
    }

    public static pageVisible(page: HTMLElement) {
        this.currentPage = page;
        if (this.currentPage === this.lastDurationPage) {
            // already got the corresponding durationAvailable event
            this.setupAnimation(page, false);
        }
    }

    private static currentPage: HTMLElement;
    private static lastDurationPage: HTMLElement;

    private static addClass(elt: HTMLElement, className: string) {
        const index = elt.className.indexOf(className);
        if (index < 0) {
            elt.className = elt.className + " " + className;
        }
    }

    private static getAnimationStylesheet(): HTMLStyleElement {
        let animationElement = document.getElementById("animationSheet");
        if (!animationElement) {
            animationElement = document.createElement("style");
            animationElement.setAttribute("type", "text/css");
            animationElement.setAttribute("id", "animationSheet");
            animationElement.innerText = ".bloom-imageContainer {overflow: hidden}";
            document.body.appendChild(animationElement);
        }
        return <HTMLStyleElement> animationElement;
    }
}
