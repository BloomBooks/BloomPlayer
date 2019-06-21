export default class VideoPlayer {
  // If the document only has containers for video, but no actual videos, return false.
  public static documentHasVideo(): boolean {
    return !!document.getElementsByTagName("video").length;
  }

  public static pageHasVideo(page: HTMLDivElement): boolean {
    return !!page.getElementsByTagName("video").length;
  }

  private static startTimes: number[] = [];
  private static hasEnded: boolean[] = [];

  // Pauses all video on a page.  Resets the videos to the beginning if the reset
  // flag is true.
  public static pauseVideo(page: HTMLDivElement, reset: boolean = false): void {
    const videoElements = page.getElementsByTagName("video");
    for (let i = 0; i < videoElements.length; i++) {
      const currentElement = videoElements[i];
      if (!currentElement.paused) {
        currentElement.pause();
        VideoPlayer.reportVideoDuration(currentElement, i);
      }
      if (reset) {
        currentElement.currentTime = 0.0;
      }
    }
    VideoPlayer.videosPlaying = 0;
  }

  // Plays the video on the page specified by the index or the first one on the page
  // if no index is given.
  public static playVideo(page: HTMLDivElement, index = 0): void {
    const videoElements = page.getElementsByTagName("video");
    if (videoElements.length > index && videoElements[index].paused) {
      videoElements[index].onended = null;
      videoElements[index].onended = (ev: Event) => {
        --VideoPlayer.videosPlaying;
        VideoPlayer.reportVideoDuration(videoElements[index], index);
        VideoPlayer.hasEnded[index] = true;
      };
      ++VideoPlayer.videosPlaying;
      // If it has ended, it's going to replay from the beginning, even though
      // (to prevent an abrupt visual effect) we didn't reset currentTime when it ended.
      VideoPlayer.startTimes[index] = VideoPlayer.hasEnded[index]
        ? 0
        : videoElements[index].currentTime;
      VideoPlayer.hasEnded[index] = false;
      videoElements[index].play();
    }
  }

  private static reportVideoDuration(v: HTMLVideoElement, index: number) {
    // Note: if we ever again use this code other than in the context of an Android
    // app, we may want to pass in information that will allow us do to this only
    // if this.androidMode.
    try {
      (<any>(<any>window).Android).videoPlayedDuration(
        (v.currentTime - VideoPlayer.startTimes[index]).toString()
      );
    } catch (e) {
      console.log(e);
    }
  }

  // Flag to query whether we are actively playing a video.
  public static isVideoPlaying(): boolean {
    return VideoPlayer.videosPlaying > 0;
  }

  // Number of videos currently playing.
  // (I'd be happier if number wasn't floating point, but it should be okay since
  // integers should be represented exactly within a very large range.)
  private static videosPlaying: number = 0;
}
