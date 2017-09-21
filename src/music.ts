import {PageVisible, PageHidden} from "./navigation";
import LiteEvent from "./pagePlayer/event";
import {Play, Pause} from "./controls";
export var Mute: LiteEvent<boolean >;

let music: Music;

export function SetupMusic() {
    music = new Music();
}
export default class Music {

    public static documentHasMusic(): boolean {
        return [].slice.call(document.body.getElementsByClassName("bloom-page")).find(p => Music.pageHasMusic(p));
    }

    public static pageHasMusic(page: HTMLElement): boolean {
        return page.attributes["data-backgroundaudio"];
    }

    private playerPage: HTMLElement;
    private haveStartedMusic: Boolean;
    private muted: boolean;
    private paused: boolean;

    public constructor() {
        PageVisible.subscribe(page => {
            if (Music.pageHasMusic(page)) {
                this.listen(page);
            }
        });
        PageHidden.subscribe(page => {
            // Nothing to do at this point
        });
        Mute = new LiteEvent<boolean>();

        Mute.subscribe((shouldMute: boolean) => {
            this.muted = shouldMute;
            if (!this.playerPage) {
                 // no music listen in progress; and we don't want to try to
                 // initialize the player while we don't have a page that
                 // has music from which to try to get the music volume.
                return;
            }
            if (!this.paused && !shouldMute) {
                this.getPlayer().play();
            } else {
                this.getPlayer().pause();
            }
        });

        Play.subscribe( () => {
            this.paused = false;
            if (this.playerPage && !this.muted) { // if not we aren't listening and can't getPlayer.
                this.getPlayer().play();
            }
         });
        Pause.subscribe( () => {
            this.paused = true;
            if (this.playerPage) { // if not we aren't listening and can't getPlayer.
                this.getPlayer().pause();
            }
        });
    }

    public listen(page: HTMLElement): void {
        if (!page) {
            alert("page was null");
        }
        const wasPaused = this.haveStartedMusic && this.getPlayer().paused;
        this.playerPage = page;
        this.setAudioSource();
        if (wasPaused) {
            this.getPlayer().pause();
        } else {
            this.play();
            this.haveStartedMusic = true;
        }
    }

    private play() {
        this.getPlayer().play();
    }

    private getPlayer(): HTMLAudioElement {
         let player = <HTMLAudioElement> document.querySelector("#music-player");
         if (!player) {
             player = <HTMLAudioElement> document.createElement("audio");
             if (!this.playerPage) {
                 console.log("Music:getPlayer() called when playerPage wasn't set.");
                 player.volume = 1;
             } else {
                let volume = this.playerPage.attributes["data-backgroundaudiovolume"];
                if (volume && volume.value) {
                    player.volume = volume.value;
                } else {
                    player.volume = 1;
                }
            }
             player.setAttribute("id", "music-player");
             document.body.appendChild(player);

             // if we just pass the function, it has the wrong "this"
             player.addEventListener("ended", () => this.playEnded());
         }
         return <HTMLAudioElement> player;
    }

    // Gecko has no way of knowing that we've created or modified the audio file,
    // so it will cache the previous content of the file or
    // remember if no such file previously existed. So we add a bogus query string
    // based on the current time so that it asks the server for the file again.
    private setAudioSource(): void {
        let player  = this.getPlayer();
        player.setAttribute("src", "audio/" + this.playerPage.attributes["data-backgroundaudio"].value +
         "?nocache=" + new Date().getTime());
    }

    private playEnded(): void {
        // continuous loop until a new page with new music comes along
        this.play();
    }
}
