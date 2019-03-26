export default class VideoPlayer {

    // If the document only has containers for video, but no actual videos, return false.
    public static documentHasVideo(): boolean {
        return !!(document.getElementsByTagName("video").length);
    }

    public static pageHasVideo(page: HTMLDivElement): boolean {
        return !!(page.getElementsByTagName("video").length);
    }

    // Pauses all video on a page.  Resets the videos to the beginning if the reset
    // flag is true.
    public static pauseVideo(page: HTMLDivElement, reset: boolean = false): void {
        const videoElements = page.getElementsByTagName("video");
        for (let i = 0; i < videoElements.length; i++) {
            const currentElement = videoElements[i];
            if (!currentElement.paused) {
                currentElement.pause();
            }
            if (reset) {
                currentElement.currentTime = 0.0;
            }
        }
    }

    // Plays the video on the page specified by the index or the first one on the page
    // if no index is given.
    public static playVideo(page: HTMLDivElement, index = 0): void {
        const videoElements = page.getElementsByTagName("video");
        if (videoElements.length > index && videoElements[index].paused) {
            videoElements[index].play();
        }
    }
}
