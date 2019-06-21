/// <reference path="../../typings/index.d.ts" />

import Animation from "./animation";
import Multimedia from "./multimedia";
import Narration from "./narration";
import {
  ComputeDuration,
  PageDuration,
  PageDurationAvailable,
  PageNarrationComplete,
  PlayAllSentences,
  PlaybackCompleted,
  SetAndroidMode,
  SetupNarrationEvents
} from "./narration";
import VideoPlayer from "./videoPlayer";

// This is the root file in webpack-config.js for generating bloomPagePlayer, a cut-down version
// of BloomPlayer designed for use embedded in an app which uses its own controls for play, pause,
// page change, and so forth.
// Currently the only such app is BloomReader, an Android app; and sadly, a few things in this
// version are very specific to interacting with the Android code.

// These variables are global so they can be accessed by necessarily global functions
// that are called directly from the app. Don't try to access them with this.whatever!
let animation: Animation;
let canInitialize = false; // set true when doc loaded
let startNarrationRequested = false; // set true when startNarration called by android
let beforeVisibleInitRequested = false; // set true when handlePageBeforeVisible called by android.
let initialized = false;
// This is used to save the value passed to enableAnimation(), in case it is
// called before we get an animation object.
let animationActive: boolean = true;
// When the doc is loaded and initialized, we store the page here so we don't have to keep
// fetching it.
let page: HTMLDivElement;

// Every function below which starts with "export function" can be called by (Android) apps
// by using 'mWebView.evaluateJavascript("Root.{function name}()", {callback or null})'
export function startNarration() {
  startNarrationRequested = true;

  if (canInitialize) {
    if (initialized) {
      // typical, we already initialized most stuff in the process of doing handlePageBeforeVisible()
      if (page) {
        PlayAllSentences(page);
        // This may or may not cause the animation to start, depending on
        // what was last passed to enableAnimation().
        animation.HandlePageVisible(page);
      }
    } else {
      // Somehow startNarration was called before handlePageBeforeVisible().
      // Not sure this can happen, but if it does, we need to set everything up.
      initialize();
    }
  }
  // otherwise, we were called before doc loaded; when it is we will proceed.
}

export function enableAnimation(doAnimate: boolean) {
  // In case this is called before we initialize() and have an animation object,
  // we need to remember the value. If we already have the animation object,
  // update it.
  animationActive = doAnimate;
  if (animation) {
    animation.setAnimationActive(doAnimate);
  }
}

export function handlePageBeforeVisible() {
  beforeVisibleInitRequested = true;

  if (canInitialize) {
    if (initialized) {
      if (page && Animation.pageHasAnimation(page)) {
        animation.HandlePageBeforeVisible(page);
      }
    } else {
      initialize();
    }
  }
  // otherwise, we were called before doc loaded; when it is we will proceed.
}

// Tells app (Android or other) whether the current page has multimedia or not.
// The return value is a string instead of boolean because the callback function
// for evaluateJavascript() is of type ValueCallback<string>.
export function requestPageMultimediaState(): string {
  if (canInitialize) {
    if (!initialized) {
      initialize();
    }
    return hasMultimedia().toString();
  }
  // don't think this can happen, but if we were called before doc loaded, we'll just get "false"
  return "false";
}

function hasMultimedia(): boolean {
  return page && Multimedia.pageHasMultimedia(page);
}

export function pauseVideo() {
  if (page && VideoPlayer.pageHasVideo(page)) {
    VideoPlayer.pauseVideo(page);
  }
}

export function stopVideo() {
  if (page && VideoPlayer.pageHasVideo(page)) {
    VideoPlayer.pauseVideo(page, true);
  }
}

export function playVideo() {
  if (page && VideoPlayer.pageHasVideo(page)) {
    VideoPlayer.playVideo(page);
  }
}

export function totalVideoLength(): string {
  if (page && VideoPlayer.pageHasVideo(page)) {
    return VideoPlayer.totalVideoLength(page);
  }
  return "0";
}

// Tells app (Android or other) whether the current page has various forms of multimedia,
// and details about animation and video if those exist.
export function getMultiMediaStatus(): string {
  const status = page
    ? {
        hasAnimation: Animation.pageHasAnimation(page),
        hasNarration: Narration.pageHasNarration(page),
        hasVideo: VideoPlayer.pageHasVideo(page),
        pageDuration: PageDuration,
        videoIsPlaying: VideoPlayer.isVideoPlaying()
      }
    : {
        hasAnimation: false,
        hasNarration: false,
        hasVideo: false,
        pageDuration: 0.0,
        videoIsPlaying: false
      };
  return JSON.stringify(status);
}

// Called by android code when android sound play completed
export function playbackCompleted() {
  PlaybackCompleted();
}

export function pauseAnimation() {
  animation.PauseAnimation();
}

export function resumeAnimation() {
  animation.PlayAnimation();
}

function initialize() {
  initialized = true;
  SetupNarrationEvents(); // very early, defines events others subscribe to.
  SetAndroidMode();
  animation = new Animation();
  // BloomReader (based on properties in the book file) controls whether
  // animations happen in all orientations or only some. We need to configure
  // the animation object to respect this, and set the current state.
  animation.setAnimationControlledByApp(true);
  animation.setAnimationActive(animationActive);

  PageDurationAvailable.subscribe(pageElement => {
    animation.HandlePageDurationAvailable(pageElement, PageDuration);
  });

  // Subscribe even if this page has no audio, since ComputeDuration will (currently) trigger page
  // completed at once in that case.
  // (Besides, quite likely even if this page has no audio, if the document as a whole has narration,
  // its title very well may have it, and that will be in the data div which is common to all pages,
  // so we will find an audio-sentence in the doc.)
  PageNarrationComplete.subscribe(() => {
    (<any>(<any>window).Android).pageCompleted();
  });
  page = <HTMLDivElement>document.body.querySelector(".bloom-page");
  if (page) {
    ComputeDuration(page); // needed later for animation, though we don't need the result right here.
    // if startNarration has been called (typically, initialize is being called from doc loaded event),
    // we need to get it started now.
    if (startNarrationRequested) {
      PlayAllSentences(page);
    }
  }
  // starting narration implies starting the animation, if any. So if that was already
  // requested (see above), start it too.
  if (startNarrationRequested) {
    animation.HandlePageVisible(page);
  } else {
    // We hope this happens during or very soon after handlePageBeforeVisible() is called,
    // so that even before the page is fully shown and animation begins, we can get the right
    // fragment of the picture showing for the initial state.
    animation.HandlePageBeforeVisible(page);
  }
}

function setCanInitialize() {
  canInitialize = true;
  if (startNarrationRequested || beforeVisibleInitRequested) {
    initialize();
  }
  // This handshake allows the Java to know not only that the page is loaded, but that the
  // Javascript itself is loaded. I think there's some redundancy here...startNarration()
  // and handlePageBeforeVisible() are not called until the Android gets this notification,
  // so we probably don't need the code above that deals with getting them before the doc
  // is ready. But with async stuff happening, I'd rather have things as robust as possible.
  (<any>(<any>window).Android).domContentLoaded();
}

document.addEventListener("DOMContentLoaded", setCanInitialize, false);

// polyfills for Android 4.4 support
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.webkitMatchesSelector;
}

// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find#Polyfill
// and https://tc39.github.io/ecma262/#sec-array.prototype.find
// But this implementation comes from https://stackoverflow.com/a/31457683/7442826
if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this == null) {
      throw new TypeError("Array.prototype.find called on null or undefined");
    }
    if (typeof predicate !== "function") {
      throw new TypeError("predicate must be a function");
    }
    const list = Object(this);
    const length = list.length >>> 0;
    const thisArg = arguments[1];
    let value;

    for (let i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}
