import "./controls.less";
import LiteEvent from "./pagePlayer/event";
import CarouselPageChanger from "./CarouselPageChanger";
import FadePageChanger from "./fadePageChanger";
import {IPageChanger} from "./IPageChanger";
import {IsLandscape} from "./layout";
import Multimedia from "./pagePlayer/multimedia";

export var PageVisible: LiteEvent<HTMLElement>;
export var PageBeforeVisible: LiteEvent<HTMLElement>;
export var PageHidden: LiteEvent<HTMLElement>;
export var GoNextPage: LiteEvent<void>;

// This class handles navigation commands from controls and
// owns the various navigation events. It determines
// what transition system (e.g. carousel or fade) that
// this book will use and manages that system.
export default class Navigation {

    private parent: HTMLElement;
    private pageChanger: IPageChanger;

    public constructor(parent: HTMLElement) {
        this.parent = parent;

        PageVisible = new LiteEvent<HTMLElement>();
        PageBeforeVisible = new LiteEvent<HTMLElement>();
        PageHidden = new LiteEvent<HTMLElement>();
        GoNextPage = new LiteEvent<void>();
        GoNextPage.subscribe( () => this.gotoNextPage());

        this.setupViewerWrapper(parent);

        window.addEventListener("orientationchange",
            () => window.setTimeout( () => this.setPageChangerForDocument(), 5));
    }

    public setPageChangerForDocument() {
        if (Multimedia.documentHasMultimedia() && IsLandscape()) {
            this.pageChanger = new FadePageChanger(this.parent);
        } else {
            this.pageChanger = new CarouselPageChanger(this.parent);
        }
    }

    public showFirstPage() {
        this.setPageChangerForDocument();
        [].forEach.call(document.body.querySelectorAll(".bloom-page"), function(page){
                page.classList.remove("currentPage");
            });

        this.firstPage().classList.add("currentPage");

        //TODO better way to do this?
        this.pageChanger.showFirstPage();
        // No animation of showing first page, but seems safest to
        // raise this event anyway.
        PageBeforeVisible.raise(this.firstPage());
        PageVisible.raise(this.firstPage());
    }

    public  gotoNextPage(): void {
        const next = this.currentPage().nextElementSibling  as HTMLElement;
        if (next) {
            this.pageChanger.transitionPage(next, true);
        } else {
            this.showFirstPage();
        }
    }

    public  gotoPreviousPage(): void {
        const target = this.currentPage().previousElementSibling  as HTMLElement;
        if (target.classList.contains("bloom-page")) {
            this.pageChanger.transitionPage(target, false);
        }
    }

    private setupViewerWrapper(parent: HTMLElement) {
        parent.insertAdjacentHTML("afterbegin", "<div id='pageViewer'></div>");
        const pageViewer = document.getElementById("pageViewer");
        const pages = document.getElementsByClassName("bloom-page");

        //REVIEW: doesn't work. we want to do this so that we can
        // get it visible and determine the size of a page for setting the scale
        pages[0].classList.add("currentPage");

        for (let index = 0; index < pages.length; index++) {
            pageViewer.appendChild(pages[index]);
        }
    }

    private  currentPage(): HTMLElement {
        return document.body.getElementsByClassName("currentPage")[0] as HTMLElement;
    }

    private  firstPage(): HTMLElement {
        return document.body.getElementsByClassName("bloom-page")[0] as HTMLElement;
    }
}
