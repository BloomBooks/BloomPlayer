import Animation from "./animation";
import Narration from "./narration";

export default class Multimedia {
    public static documentHasMultimedia(): boolean {
        return Narration.documentHasNarration() || Animation.documentHasAnimation();
    }
}
