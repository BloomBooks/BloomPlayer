import LiteEvent from "./event";

const kSegmentClass = "bloom-highlightSegment";
const kAudioSentence = "audio-sentence"; // Even though these can now encompass more than strict sentences, we continue to use this class name for backwards compatability reasons

// This can (and should) be called very early in the setup process, before any of the setup calls that use
// these events.
export function SetupNarrationEvents(): void {
    PageDurationAvailable = new LiteEvent<HTMLElement>();
    PageNarrationComplete = new LiteEvent<HTMLElement>();
}

// Clients ought to be able to import Narration and call these directly, but I can't figure out how.
export function PlayNarration(): void {
    Narration.play();
}

export function PauseNarration(): void {
    Narration.pause();
}

export function PlayAllSentences(page: HTMLElement): void {
    Narration.playAllSentences(page);
}

export function ComputeDuration(page: HTMLElement): void {
    Narration.computeDuration(page);
}

export function PlaybackCompleted(): void {
    Narration.playEnded();
}

export function SetAndroidMode(): void {
    Narration.androidMode = true;
}

export var PageDuration: number;
export var PageDurationAvailable: LiteEvent<HTMLElement>;
export var PageNarrationComplete: LiteEvent<HTMLElement>;

// Todo: to highlight current sentence, define properties for class ui-audioCurrent

enum Status {
    Disabled, // Can"t use button now (e.g., Play when there is no recording)
    Enabled, // Can use now, not the most likely thing to do next
    Expected, // The most likely/appropriate button to use next (e.g., Play right after recording)
    Active // Button now active (Play while playing; Record while held down)
};

export default class Narration {
    public static androidMode: boolean = false;
    public static Pause: LiteEvent<void>;

    public static documentHasNarration(): boolean {
        return !!this.getDocumentAudioElements().length;
    }

    public static pageHasNarration(page: HTMLDivElement): boolean {
        return !!this.getPageAudioElements(page).length;
    }

    public static play() {
        if (this.segments.length) {
            Narration.getPlayer().play();
        }
        this.paused = false;
        // adjust startPlay by the elapsed pause. This will cause fakePageNarrationTimedOut to
        // start a new timeout if we are depending on it to fake PageNarrationComplete.
        const pause = (new Date().getTime() - this.startPause.getTime());
        this.startPlay = new Date(this.startPlay.getTime() + pause);
        //console.log("paused for " + pause + " and adjusted start time to " + this.startPlay);
        if (this.fakeNarrationAborted) {
            // we already paused through the timeout for normal advance.
            // This call (now we are not paused and have adjusted startPlay)
            // will typically start a new timeout. If we are very close to
            // the desired duration it may just raise the event at once.
            // Either way we should get the event raised exactly once
            // at very close to the right time, allowing for pauses.
            this.fakeNarrationAborted = false;
            this.fakePageNarrationTimedOut(this.playerPage);
        }
    }

    public static pause() {
        if (this.segments.length) {
            Narration.getPlayer().pause();
        }
        this.paused = true;
        this.startPause = new Date();
    }

    public static playAllSentences(page: HTMLElement): void {
        this.playerPage = page;

        this.elementsToPlayConsecutivelyStack = this.getPageAudioElements().reverse();

        const stackSize = this.elementsToPlayConsecutivelyStack.length;
        if (stackSize === 0) {
            // Nothing to play
            PageNarrationComplete.raise();
            return;
        }
        const firstElementToPlay = this.elementsToPlayConsecutivelyStack[
            stackSize - 1
        ]; // Remember to pop it when you're done playing it. (i.e., in playEnded)

        this.setSoundAndHighlight(firstElementToPlay, true);
        this.playCurrentInternal();
    }

    public static computeDuration(page: HTMLElement): void {
        this.playerPage = page;
        this.segments = this.getPageAudioElements();
        this.pageDuration = 0.0;
        this.segmentIndex = -1; // so pre-increment in getNextSegment sets to 0.
        this.startPlay = new Date();
        //console.log("started play at " + this.startPlay);
        // in case we are already paused (but did manual advance), start computing
        // the pause duration from the beginning of this page.
        this.startPause = this.startPlay;
        if (this.segments.length === 0) {
            if (this.androidMode) {
                // We need this to allow animation to start, for cases where we have
                // that but no audio.
                PageDuration = 3.0;
                PageDurationAvailable.raise(page);
                // don't want to try to simulate a PageNarrationComplete at the end of
                // the animation, because Android is really handling the audio, pause, play,
                // etc. and it's not set up to abort the event. As far as narration is
                // concerned, this page is done; the player will take care not to
                // advance too soon, if it is set to auto-advance at all.
                PageNarrationComplete.raise();
                return;
            }
            PageDuration = 3.0;
            PageDurationAvailable.raise(page);
            // Since there is nothing to play, we will never get an 'ended' event
            // from the player. If we are going to advance pages automatically,
            // we need to raise PageNarrationComplete some other way.
            // A timeout allows us to raise it after the arbitrary duration we have
            // selected. The tricky thing is to allow it to be paused.
            setTimeout(() => this.fakePageNarrationTimedOut(page), PageDuration * 1000);
            this.fakeNarrationAborted = false;
            return;
        }
        // trigger first duration evaluation. Each triggers another until we have them all.
        this.getNextSegment();
        //this.getDurationPlayer().setAttribute("src", this.currentAudioUrl(this.segments[0].getAttribute("id")));
    }

    public static playEnded(): void {
        if (
            this.elementsToPlayConsecutivelyStack &&
            this.elementsToPlayConsecutivelyStack.length > 0
        ) {
            const currentElement = this.elementsToPlayConsecutivelyStack.pop();
            const newStackCount = this.elementsToPlayConsecutivelyStack.length;
            if (newStackCount > 0) {
                // More items to play
                const nextElement = this.elementsToPlayConsecutivelyStack[
                    newStackCount - 1
                ];
                this.setSoundAndHighlight(nextElement, true);
                this.playCurrentInternal();
                return;
            } else {
                // Nothing left to play
                this.elementsToPlayConsecutivelyStack = [];
                this.subElementsWithTimings = [];
            }

            this.removeAudioCurrent();
            PageNarrationComplete.raise(this.playerPage);

            return;
        }
    }

    public static canPlayAudio(current: Element): boolean {
        if (this.androidMode) {
            // Can't get using the player to work on Android, so we just use a callback to
            // ask the Android to play it for us. It will call playEnded when appropriate.
            // In this case the Android also handles all the pause/resume logic so the code
            // here connected with play and resume is not used.
            return (<any> (<any> (window)).Android).audioExists(this.currentAudioUrl(current.getAttribute("id")));
        } else {
            return true; // currently no way to check in regular player mode.
        }
    }

    private static playerPage: HTMLElement;
    private static currentAudioId: string;
    private static segments: HTMLElement[];
    private static segmentIndex: number;
    // The first one to play should be at the end for all of these
    private static elementsToPlayConsecutivelyStack: HTMLElement[] = []; // The audio-sentence elements (ie those with actual audio files associated with them) that should play one after the other
    private static subElementsWithTimings: Array<[Element, number]> = [];

    private static pageDuration: number;
    private static paused: boolean = false;
    // The time we started to play the current page (set in computeDuration, adjusted for pauses)
    private static startPlay: Date;
    private static startPause: Date;
    private static fakeNarrationAborted: boolean = false;

    private static fakePageNarrationTimedOut(page: HTMLElement) {
        if (this.paused) {
            this.fakeNarrationAborted = true;
            return;
        }
        // It's possible we experienced one or more pauses and therefore this timeout
        // happened too soon. In that case, this.startPlay will have been adjusted by
        // the pauses, so we can detect that here and start a new timeout which will
        // occur at the appropriately delayed time.
        const duration = (new Date().getTime() - this.startPlay.getTime()) / 1000;
        if ( duration < PageDuration - 0.01) {
            // too soon; try again.
            setTimeout(() => this.fakePageNarrationTimedOut(page), (PageDuration - duration) * 1000);
            return;
        }
        PageNarrationComplete.raise(page);
    }

    private static getNextSegment() {
        this.segmentIndex++;
        if (this.segmentIndex < this.segments.length) {
            const attrDuration = this.segments[this.segmentIndex].getAttribute("data-duration");
            if (attrDuration) {
                // precomputed duration available, use it and go on.
                this.pageDuration += parseFloat(attrDuration);
                this.getNextSegment();
                return;
            }
            // Replace this with the commented code to have ask the browser for duration.
            // (Also uncomment the getDurationPlayer method)
            // However, this doesn't work in apps.
            this.getNextSegment();
            // this.getDurationPlayer().setAttribute("src",
            //     this.currentAudioUrl(this.segments[this.segmentIndex].getAttribute("id")));
        } else {
            if (this.pageDuration < 3.0) {
                this.pageDuration = 3.0;
            }
            PageDuration = this.pageDuration;
            PageDurationAvailable.raise(this.playerPage);
        }
    }

    // Returns all elements that match CSS selector {expr} as an array.
    // Querying can optionally be restricted to {container}’s descendants
    // If includeSelf is true, it includes both itself as well as its descendants.
    // Otherwise, it only includes descendants.
    private static findAll(expr: string, container: HTMLElement, includeSelf: boolean = false): HTMLElement[] {
        // querySelectorAll checks all the descendants
        let allMatches: HTMLElement[] = [].slice.call((container || document).querySelectorAll(expr));

        // Now check itself
        if (includeSelf && container && container.matches(expr)) {
            allMatches.push(container);
        }

        return allMatches;
    }

    private static getPlayableDivs(container: HTMLElement) {
        // We want to play any audio we have from divs the user can see.
        // This is a crude test, but currently we always use display:none to hide unwanted languages.
        return this.findAll("div.bloom-editable", container).filter(e => window.getComputedStyle(e).display !== "none");
    }

    private static getDocRecordableDivs(): HTMLElement[] {
        return this.getPlayableDivs(document.body);
    }

    private static getDocumentAudioElements(): HTMLElement[] {
        return [].concat.apply([], this.getDocRecordableDivs().map(x => this.findAll(".audio-sentence", x, true)));
    }

    // Optional param is for use when 'playerPage' has NOT been initialized.
    // Not using the optional param assumes 'playerPage' has been initialized
    private static getPageRecordableDivs(page?: HTMLElement): HTMLElement[] {
        return this.getPlayableDivs(page ? page : this.playerPage);
    }

    // Optional param is for use when 'playerPage' has NOT been initialized.
    // Not using the optional param assumes 'playerPage' has been initialized
    private static getPageAudioElements(page?: HTMLElement): HTMLElement[] {
        return [].concat.apply([], this.getPageRecordableDivs(page).map(x => this.findAll(".audio-sentence", x, true)));
    }

    private static setSoundAndHighlight(
        newElement: Element,
        disableHighlightIfNoAudio: boolean,
        oldElement: Element = null
    ) {
        this.setHighlightTo(newElement, disableHighlightIfNoAudio, oldElement);
        this.setSoundFrom(newElement);
    }

    private static setHighlightTo(
        newElement: Element,
        disableHighlightIfNoAudio: boolean,
        oldElement?: Element
    ) {
        if (oldElement === newElement) {
            // No need to do much, and better not to, so that we can avoid any temporary flashes as the highlight is removed and re-applied
            return;
        }

        this.removeAudioCurrent();

        if (disableHighlightIfNoAudio) {
            const mediaPlayer = this.getPlayer();
            const isAlreadyPlaying = mediaPlayer.currentTime > 0;

            // If it's already playing, no need to disable (Especially in the Soft Split case, where only one file is playing but multiple sentences need to be highlighted).
            if (!isAlreadyPlaying) {
                // Start off in a highlight-disabled state so we don't display any momentary highlight for cases where there is no audio for this element.
                // In react-based bloom-player, canPlayAudio() can't trivially identify whether or not audio exists,
                // so we need to incorporate a derivative of Bloom Desktop's disableHighlight code
                newElement.classList.add("disableHighlight");
                mediaPlayer.addEventListener("playing", event => {
                    newElement.classList.remove("disableHighlight");
                });
            }
        }

        newElement.classList.add("ui-audioCurrent");
    }

    private static setSoundFrom(element: Element) {
        const firstAudioSentence = this.getFirstAudioSentenceWithinElement(
            element
        );
        const id: string = firstAudioSentence
            ? firstAudioSentence.id
            : element.id;
        this.setCurrentAudioId(id);
    }

    public static getFirstAudioSentenceWithinElement(
        element: Element
    ): Element {
        const audioSentences = this.getAudioSegmentsWithinElement(element);
        if (!audioSentences || audioSentences.length === 0) {
            return null;
        }

        return audioSentences[0];
    }

    public static getAudioSegmentsWithinElement(element: Element): Element[] {
        const audioSegments: Element[] = [];

        if (element) {
            if (element.classList.contains(kAudioSentence)) {
                audioSegments.push(element);
            } else {
                const collection = element.getElementsByClassName(
                    kAudioSentence
                );
                for (let i = 0; i < collection.length; ++i) {
                    const audioSentenceElement = collection.item(i);
                    if (audioSentenceElement) {
                        audioSegments.push(audioSentenceElement);
                    }
                }
            }
        }

        return audioSegments;
    }

    // Setter for currentAudio
    public static setCurrentAudioId(id: string) {
        if (!this.currentAudioId || this.currentAudioId !== id) {
            this.currentAudioId = id;
            this.updatePlayerStatus();
        }
    }

    private static removeClass(elt: Element, className: string) {
        const index = elt.className.indexOf(className);
        if (index >= 0) {
            elt.className = elt.className.slice(0, index)
                + elt.className.slice(index + className.length, elt.className.length);
        }
    }

    private static addClass(elt: HTMLElement, className: string) {
        const index = elt.className.indexOf(className);
        if (index < 0) {
            elt.className = elt.className + " " + className;
        }
    }

    private static getPlayer(): HTMLMediaElement {
        return this.getAudio("player", (audio) => {
              // if we just pass the function, it has the wrong "this"
             audio.addEventListener("ended", () => this.playEnded());
             audio.addEventListener("error", () => this.playEnded());
        });
    }

    private static getAudio(id: string, init: Function) {
         let player  = document.querySelector("#" + id);
         if (!player) {
             player = document.createElement("audio");
             player.setAttribute("id", id);
             document.body.appendChild(player);
             init(player);
         }
         return <HTMLMediaElement> player;
    }

    // Gecko has no way of knowing that we"ve created or modified the audio file,
    // so it will cache the previous content of the file or
    // remember if no such file previously existed. So we add a bogus query string
    // based on the current time so that it asks the server for the file again.
    // Fixes BL-3161
    private static updatePlayerStatus() {
        const player  = this.getPlayer();
        player.setAttribute("src", this.currentAudioUrl( this.currentAudioId)
            + "?nocache=" + new Date().getTime());
    }

    private static currentAudioUrl(id: string): string {
        return "audio/" + id + ".mp3";
    }

    private static setStatus(which: string, to: Status): void {
        // Todo: anything?
    }

    private static playCurrentInternal() {
        if (!this.paused) {
            const element = this.playerPage.querySelector(
                `#${this.currentAudioId}`
            );
            if (!element || !this.canPlayAudio(element)) {
                this.playEnded();
                return;
            }

            const timingsStr: string = element.getAttribute(
                "data-audioRecordingEndTimes"
            );
            if (timingsStr) {
                const childSpanElements = element.querySelectorAll(
                    `span.${kSegmentClass}`
                );
                const fields = timingsStr.split(" ");
                const subElementCount = Math.min(
                    fields.length,
                    childSpanElements.length
                );

                this.subElementsWithTimings = [];
                for (let i = subElementCount - 1; i >= 0; --i) {
                    const durationSecs: number = Number(fields[i]);
                    if (isNaN(durationSecs)) {
                        continue;
                    }
                    this.subElementsWithTimings.push([
                        childSpanElements.item(i),
                        durationSecs
                    ]);
                }
            } else {
                // No timings string available.
                // No need for us to do anything. The correct element is already highlighted by playAllSentences() (which needed to call setCurrent... anyway to set the audio player source).
                // We'll just proceed along, start playing the audio, and playNextSubElement() will return immediately because there are no sub-elements in this case.
            }

            if (this.androidMode) {
                // Can't get using the player to work on Android, so we just use a callback to
                // ask the Android to play it for us. It will call playEnded when appropriate.
                // In this case the Android also handles all the pause/resume logic so the code
                // here connected with play and resume is not used.
                (<any> (<any> (window)).Android).playAudio(this.currentAudioUrl(this.currentAudioId));
            } else {
                (<any> this.getPlayer().play()).catch(reason => {
                    console.log("could not play sound: " + reason);
                    if (this.Pause) {
                        this.Pause.raise();
                    }
                });
            }

            this.highlightNextSubElement();
        }
    }
    
    private static highlightNextSubElement() {
        // the item should not be popped off the stack until it's completely done with.
        const subElementCount = this.subElementsWithTimings.length;

        if (subElementCount <= 0) {
            return;
        }

        const topTuple = this.subElementsWithTimings[subElementCount - 1];
        const element = topTuple[0];
        const endTimeInSecs: number = topTuple[1];

        this.setHighlightTo(element, false);

        const mediaPlayer: HTMLMediaElement = document.getElementById(
            "player"
        ) as HTMLMediaElement;

        const currentTimeInSecs = mediaPlayer.currentTime;
        
        // Handle cases where the currentTime has already exceeded the nextStartTime
        //   (might happen if you're unlucky in the thread queue... or if in debugger, etc.)
        // But instead of setting time to 0, set the minimum highlight time threshold to 0.1 (this threshold is arbitrary).
        const durationInSecs = Math.max(endTimeInSecs - currentTimeInSecs, 0.1);
        console.log("currentTimeInSecs: " + currentTimeInSecs);
        console.log("Timeout duration: " + durationInSecs);

        setTimeout(() => {
            this.onSubElementHighlightTimeEnded();
        }, durationInSecs * 1000);
    }

    // Handles a timeout indicating that the expected time for highlighting the current subElement has ended.
    // If we've really played to the end of that subElement, highlight the next one (if any).
    private static onSubElementHighlightTimeEnded() {
        const subElementCount = this.subElementsWithTimings.length;
        if (subElementCount <= 0) {
            return;
        }

        const mediaPlayer: HTMLMediaElement = document.getElementById(
            "player"
        ) as HTMLMediaElement;
        if (mediaPlayer.ended || mediaPlayer.error) {
            // audio playback ended. No need to highlight anything else.
            // (No real need to remove the highlights either, because playEnded() is supposed to take care of that.)
            return;
        }
        const playedDurationInSecs: number =
            mediaPlayer.currentTime;

        // Peek at the next sentence and see if we're ready to start that one. (We might not be ready to play the next audio if the current audio got paused).
        const subElementWithTiming = this.subElementsWithTimings[
            subElementCount - 1
        ];
        const nextStartTimeInSecs = subElementWithTiming[1];

        if (
            playedDurationInSecs &&
            playedDurationInSecs < nextStartTimeInSecs
        ) {
            // Still need to wait. Exit this function early and re-check later.
            const minRemainingDurationInSecs =
                nextStartTimeInSecs - playedDurationInSecs;
            setTimeout(() => {
                this.onSubElementHighlightTimeEnded();
            }, minRemainingDurationInSecs * 1000);

            return;
        }

        this.subElementsWithTimings.pop();

        this.highlightNextSubElement();
    }

    // Removes the .ui-audioCurrent class from all elements
    // Equivalent of removeAudioCurrentFromPageDocBody() in BloomDesktop.
    private static removeAudioCurrent() {
        // Note that HTMLCollectionOf's length can change if you change the number of elements matching the selector.
        const audioCurrentCollection = document.getElementsByClassName("ui-audioCurrent");

        // Convert to an array whose length won't be changed
        const audioCurrentArray: Element[] = [];
        for (let i = 0; i < audioCurrentCollection.length; ++i) {
            audioCurrentArray.push(audioCurrentCollection.item(i));
            audioCurrentArray[i].classList.remove("ui-audioCurrent");
        }
    }
}
