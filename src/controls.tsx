/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import Navigation from "./navigation";
import "./controls.less";
import {Mute} from "./music";
import LiteEvent from "./pagePlayer/event";
import Music from "./music";
import Multimedia from "./pagePlayer/multimedia";

export var Play: LiteEvent<void>;
export var Pause: LiteEvent<void>;

let paused: boolean = false;

export function IsPaused(): boolean {
    return paused;
}

// Controls is the overlay of buttons that controls
// navigation, play/pause, toggling the music, etc.
export default class Controls {
    private navigation: Navigation;
    private buttonsEnabled: boolean = true;
    private buttonEnableTimer: number;

    public constructor(navigation: Navigation) {
        this.navigation = navigation;
        Play = new LiteEvent<void>();
        Pause = new LiteEvent<void>();

        document.body.insertAdjacentHTML("afterbegin", "<div id='control-root'></div>");
        const controlRoot: HTMLElement = document.getElementById("control-root");
        controlRoot.addEventListener("touchstart", (event) => {
            if (!controlRoot.classList.contains("touchCapabilityDetected")) {
                // Our very first touch! Presumably no hover detection, so buttons hidden.
                // Therefore buttons should not respond to THIS touch. They will get
                // enabled at end of this touch.
                this.buttonsEnabled = false;
            }
            controlRoot.classList.add("touchCapabilityDetected");
            controlRoot.classList.add("displayBasedOnTouch");
            clearTimeout(this.buttonEnableTimer); // half a second from earlier click must do nothing
            this.buttonEnableTimer = setTimeout(() => {
                controlRoot.classList.remove("displayBasedOnTouch");
                // Half a second after we hide the buttons we disable them.
                // This avoids the annoyance of missing because the button disappeared
                // just as you tapped it.
                setTimeout(() => {
                    this.buttonsEnabled = false;
                }, 500)
            } , 5000);
        }, false);
        
        controlRoot.addEventListener("touchend", (event) => {
            // after the end of the touch that showed the buttons, we enable them...if still visible
            if (controlRoot.classList.contains("displayBasedOnTouch")) {
                // We need SOME delay here, because this triggers BEFORE the click handler on
                // the button that may also have been clicked.
                setTimeout(() => {
                    this.buttonsEnabled = true;
                }, 20)
            }
        }, false);

        // For now we consider a document multimedia if it has either narration or animation.
        if (Multimedia.documentHasMultimedia()) {
            controlRoot.classList.add("multimedia");
        }

        // similarly, we mark the controls if the document has any background music
        let musicButton;
        if (Music.documentHasMusic()) {
            controlRoot.classList.add("hasMusic");
            musicButton = (<div id="musicButton" className= "button"
                            onClick={(event: Event)  => {
                                    if (this.buttonsEnabled) {
                                    const isOff: boolean  = (event.target as HTMLElement).classList.contains("off");
                                    //Start playing only if the overall multimedia is not paused, and 
                                    //also music was previously turned off by the user
                                    Mute.raise(!isOff);
                                    (event.target as HTMLElement).classList.toggle("off");
                                }
                            } } />);
        }

        ReactDOM.render(
            <div id="controls">
                <div id="toolbar">
                    <div id="homeButton" className="button"
                        onClick={() => {
                            if (this.buttonsEnabled) {
                                this.navigation.showFirstPage();
                            }
                        } }/>
                    {musicButton}
                    {/* <div id="narrationButton" className="button"
                        onClick={() => alert("will someday toggle narration")}/> */}
                    <div id="bloomButton" className="button"
                        onClick={() => {
                            if (this.buttonsEnabled) {
                                alert("This book was created with Bloom. Find more books at BloomLibrary.org");
                            }
                        } }/>
                </div>
                <div id="middleBar">
                    <div id="previousButton" className="button"
                        onClick={() => {
                            if (this.buttonsEnabled) {
                                this.navigation.gotoPreviousPage();
                            }
                        } } />
                    <div id="playAndPauseButton" className="button"
                        onClick={(event: Event) => {
                            if (this.buttonsEnabled) {
                                paused = !paused;
                                const btn: HTMLElement = event.target as HTMLElement;
                                if (paused) {
                                    btn.classList.add("paused");
                                    Pause.raise();
                                } else {
                                    btn.classList.remove("paused");
                                    Play.raise();
                                }
                            }
                        } } />
                    <div id="nextButton" className="button"
                        onClick={() => {
                            if (this.buttonsEnabled) {
                                this.navigation.gotoNextPage();
                            }
                        } } />
                </div>
            </div>,
            controlRoot
        );
    }
    
    // private buttonsEnabled() :boolean {
    //     const controlRoot: HTMLElement = document.getElementById("control-root");
    //     if (!controlRoot.classList.contains("touchCapabilityDetected")) {
    //         return true; // no touch, buttons visble if mouse over them
    //     }
    //     // If it is a touch screen, buttons are enabled only if visible,
    //     // which once we detect a touch screen is only while this class is present.
    //     // Review: what if the button very recently disappeared?
    //     return controlRoot.classList.contains("displayBasedOnTouch");
    // }
}