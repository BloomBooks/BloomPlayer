/// <reference path="../typings/index.d.ts" />

import {SetupLayout, SetupLayoutEvents} from "./layout";
import Animation from "./pagePlayer/animation";
import {SetupMusic} from "./music";
import {SetupNarrationEvents, PageNarrationComplete, PageDurationAvailable, PageDuration,
    PlayNarration, PauseNarration, PlayAllSentences, ComputeDuration} from "./pagePlayer/narration";
import Controls from "./controls";
import Navigation, {GoNextPage} from "./navigation";
import {Scale} from "./layout";
import Multimedia from "./pagePlayer/multimedia";
import {Play, Pause} from "./controls";
import {PageVisible, PageBeforeVisible} from "./navigation";
import FadePageChanger from "./fadePageChanger";

let animation: Animation;
let controls: Controls;

function attach() {
     if (document.getElementById("root")) {
        // this is not being called (that's good)
        console.log("mystery second call of attach");
        return;
     }
    // this slight delay makes it possible to catch breakpoints in vscode even for things that happen right away.
     window.setTimeout( () => {
        if (document.getElementById("root")) {
            // this is being called (that's bad)
            console.log("mystery second call of attach.timeout");
            return;
        }
        SetupLayout();

        setUpDomForPlaying();

        SetupNarrationEvents();  // very early, defines events others subscribe to.
        animation = new Animation();
        animation.SetFadePageTransitionMilliseconds(FadePageChanger.transitionMilliseconds);
        PageVisible.subscribe(page => animation.HandlePageVisible(page));
        PageBeforeVisible.subscribe(page => animation.HandlePageBeforeVisible(page));
        PageDurationAvailable.subscribe(page => {
            animation.HandlePageDurationAvailable(page, PageDuration); }
    );
        Play.subscribe(() =>  animation.PlayAnimation());
        Pause.subscribe(() => animation.PauseAnimation());

        SetupMusic();
        Play.subscribe(() => PlayNarration());
        Pause.subscribe(() => PauseNarration());
        PageVisible.subscribe(page => {
            PlayAllSentences(page);
        });
        // Todo: stop playing when page hidden?
        PageBeforeVisible.subscribe(page => {
            ComputeDuration(page);
        });
        SetupLayoutEvents();
        (<any> window).navigation.showFirstPage();

        //nav.GotoFirstPage(); // now go to first page again so that all the fancy stuff gets triggered

        //commented out because we are getting these events even if there is no narration.
        if (Multimedia.documentHasMultimedia()) {
            PageNarrationComplete.subscribe(page => {
                if (page === (<any> window).navigation.currentPage()) {
                    GoNextPage.raise();
                }
            });
        }
    // increase this number if doing source-level debugging an a breakpoint early in this method isn't being hit
    }, 100);
}

function setUpDomForPlaying() {
    document.body.insertAdjacentHTML("afterbegin", "<div id='root'></div>");
    const rootElement = document.getElementById("root");
    rootElement.insertAdjacentHTML("afterbegin", "<div id='scaler'></div>");
    const scalerElement = document.getElementById("scaler");

    window.setTimeout( () => scalerElement.style.transform =  "scale(" + Scale() + ")");

    (<any> window).navigation = new Navigation(scalerElement);
    controls = new Controls((<any> window).navigation);
}

document.addEventListener("DOMContentLoaded", attach, false);
