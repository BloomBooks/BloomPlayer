import "./layout.less";
import {PageHidden, PageVisible} from "./navigation";

// "Layout" here is the task of fitting the material to the device
// and orientation.

export function SetupLayout() {
    //tell smart phone that we are taking care of zooming to fit them
    document.head.insertAdjacentHTML("afterBegin",
        "<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'>");
    setOrientation();

    adjust();
    window.addEventListener("resize", () => window.setTimeout( adjust, 500));
    window.addEventListener("orientationchange", () => window.setTimeout( adjust, 100));
    window.addEventListener("orientationchange", setOrientation);
}

export function SetupLayoutEvents() {
    PageVisible.subscribe( (page) => {
        window.setTimeout(() => {
            page.classList.add("showDisplayEffect"); //cause title to fade in
        }, 0);
    });
    PageHidden.subscribe( (page) => {
        page.classList.remove("showDisplayEffect"); //so it's ready if we show this page again
    });
}

export function Scale(): number {
    var fullScreenAttr = document.body.getAttribute("data-bffullscreenpicture");
    if (IsLandscape() &&
        (fullScreenAttr.indexOf("landscape") >= 0 
        || fullScreenAttr.indexOf("allOrientations") >= 0)) {
        // doing motion animation. Image container will be zoomed to fill window.
        // if we also scale it, results are weird.
        // Note: the conditions in the CSS for full-screen-picture to actually apply
        // are much more complex. BloomPlayer is about to be replaced with a fully
        // React component, so I'm not inclined to try to replicate them all.
        // Even if we wanted to, it's not clear whether BloomPlayer should have its
        // own media setting or borrow the bloomReader one.
        return 1;
    }
    //Enhance: would using meta.viewport be better?
    //http://stackoverflow.com/questions/8735457/scale-fit-mobile-web-content-using-viewport-meta-tag?rq=1

    const pageWidth = document.querySelectorAll(".currentPage")[0].scrollWidth;
    const pageHeight = document.querySelectorAll(".currentPage")[0].scrollHeight;
    if (!pageWidth) {
        debugger;
    }
    //using "self" here, instead of "window", makes it get the dimension of the enclosing iframe when
    //we are running in a frame instead of getting the whole windows (e.g. intel xdk "emulator" (which
    //is nothing of the sort... according to intel docs, it's just an iframe in web-kit) )
    return Math.min((self.innerWidth ) / pageWidth, (self.innerHeight ) / pageHeight);
}

export function IsLandscape() {
    return (<any> window.screen).orientation.type.indexOf("landscape") > -1;
}

function adjust() {
    console.log("adjusting");

    const scaler = document.getElementById("scaler");
    if (scaler) {
        scaler.style.transform = "scale(" + Scale() + ")";
    }
}

function setOrientation() {
    console.log("changing orientation");
    const pages = document.querySelectorAll(".bloom-page");
    for (let index = 0; index < pages.length; index++) {
        const page = pages[index];

        //remove existing orientation class
        for (let i = 0; i < page.classList.length; i++) {
            const classname = page.classList[i];
            if (classname.indexOf("Portrait") > -1 || classname.indexOf("Landscape") > -1 ) {
                page.className = page.className.replace(classname, "");
            }
        }

        //note: both FF and Chrome always report "landscape" on desktops
        //(unless you're in Chrome's Device Toolbar mode)
        //add in the class we want
        if (IsLandscape()) {
            page.classList.add("Device16x9Landscape");
        } else {
            page.classList.add("Device16x9Portrait");
        }
    }
}
