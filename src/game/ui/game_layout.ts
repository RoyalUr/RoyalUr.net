//
// Manages the layout of components for playing a game.
//

import {GameSetupMenu} from "@/game/ui/menu";
import {getCanvasByID, getDivByID, getElemByID, min} from "@/common/utils";
import {Vec2} from "@/common/vectors";
import {Bounds} from "@/common/bounds";
import {resourceLoader} from "@/game/game_resources";


const maxWidthOnHeightRatio = 1.5;


/**
 * Controls the layout of the game components on the screen.
 */
export class GameLayout {

    hoveredTile: Vec2 = Vec2.NEG1;
    draggedTile: Vec2 = Vec2.NEG1;

    /** The bounds of gameDiv. **/
    gameBounds: Bounds = null;

    /** The bounds within gameBounds to be used for the game. **/
    useGameBounds: Bounds = null;

    /** The centre relative to the gameBounds. **/
    centre: Vec2 = null;

    readonly gameDiv: HTMLDivElement;
    readonly gameSetupMenu: GameSetupMenu;

    readonly controlsDiv: HTMLDivElement;
    readonly exitControlButton: HTMLElement;

    readonly headerDiv: HTMLDivElement;
    readonly footerDiv: HTMLDivElement;

    readonly waitingForFriendDiv: HTMLDivElement;
    readonly waitingForFriendLinkTextBox: HTMLDivElement;

    readonly loadingDiv: HTMLDivElement;
    readonly loadingTextSpan: HTMLElement;

    readonly boardCanvas: HTMLCanvasElement;
    readonly boardCtx: CanvasRenderingContext2D;

    readonly tilesCanvas: HTMLCanvasElement;
    readonly tilesCtx: CanvasRenderingContext2D;

    readonly winDiv: HTMLDivElement;
    readonly winMessageDiv: HTMLDivElement;
    readonly winPlayAgainButton: HTMLElement;
    readonly winBackToHomeButton: HTMLElement;

    readonly networkStatusElement: HTMLElement;

    readonly messageContainerElement: HTMLElement;
    readonly messageTitleElement: HTMLElement;
    readonly messageSubtitleElement: HTMLElement;
    readonly joinDiscordElement: HTMLElement;
    readonly starGithubElement: HTMLElement;

    readonly overlayCanvas: HTMLCanvasElement;
    readonly overlayCtx: CanvasRenderingContext2D;

    constructor() {
        this.gameDiv = getDivByID("game");
        this.gameSetupMenu = GameSetupMenu.createDefault();

        this.controlsDiv = getDivByID("controls");
        this.exitControlButton = getElemByID("exit-control");

        this.headerDiv = getDivByID("header-full-width");
        this.footerDiv = getDivByID("footer-full-width");

        this.waitingForFriendDiv = getDivByID("waiting-for-friend");
        this.waitingForFriendLinkTextBox = getDivByID("waiting-for-friend-link");

        this.loadingDiv = getDivByID("loading");
        this.loadingTextSpan = getElemByID("loading-text");

        this.boardCanvas = getCanvasByID("board");
        this.boardCtx = this.boardCanvas.getContext("2d");

        this.tilesCanvas = getCanvasByID("tiles");
        this.tilesCtx = this.tilesCanvas.getContext("2d");

        this.winDiv = getDivByID("win");
        this.winMessageDiv = getDivByID("winner-message");
        this.winPlayAgainButton = getElemByID("win-mode-again-button");
        this.winBackToHomeButton = getElemByID("win-home-button");

        this.networkStatusElement = getElemByID("network-status");

        this.messageContainerElement = getElemByID("message-container");
        this.messageTitleElement = getElemByID("message-title");
        this.messageSubtitleElement = getElemByID("message-subtitle");
        this.joinDiscordElement = getElemByID("join-discord");
        this.starGithubElement = getElemByID("star-github");

        this.overlayCanvas = getCanvasByID("overlay");
        this.overlayCtx = this.overlayCanvas.getContext("2d");
    }

    detectGameSize(): Bounds {
        return Bounds.of(this.gameDiv);
    }

    detectResize(): void {
        const gameBounds = this.detectGameSize();
        if (!gameBounds.equals(this.gameBounds)) {
            this.resize();
        }
        window.requestAnimationFrame(() => this.detectResize());
    }

    resize() {
        this.gameBounds = this.detectGameSize();
        this.centre = Vec2.create(
            Math.round(this.gameBounds.width / 2),
            Math.round(this.gameBounds.height / 2)
        );

        const useWidth = this.gameBounds.width;
        const useHeight = min(Math.round(useWidth / maxWidthOnHeightRatio), this.gameBounds.height);
        this.useGameBounds = Bounds.create(
            this.centre.x - Math.round(useWidth / 2),
            this.centre.x - Math.round(useHeight / 2),
            useWidth,
            useHeight
        );

        this.gameSetupMenu.resize();
        resizeOverlay();

        if (resourceLoader.loadingStage > 1) {
            resizeBoard();
            resizeScores();
            resizeDice();
        }
        redraw(true);
    }
}
