//
// This file mediates interactions between the client, the server, the model, and the rendering of the game.
//

import {getTime, LONG_TIME_AGO} from "@/common/utils";
import {updateRenderStatistics} from "@/game/analytics/stats";
import {
    debug,
    disconnect,
    registerPacketHandler, sendPacket,
    setNetworkConnectedHandler,
    setNetworkConnectingHandler, setNetworkDisconnectHandler, setNetworkLostConnectionHandler
} from "@/game/network/network";
import {audioSystem, imageSystem, resourceLoader} from "@/game/game_resources";
import {Game} from "@/game/game/game";
import {GameSetupMenu} from "@/game/ui/menu";


export class Client {
    startTime: number;
    menuResourcesLoadedTime: number = LONG_TIME_AGO;
    clientFinishSetupTime: number = LONG_TIME_AGO;

    private gameSetupMenu: GameSetupMenu | null;
    private game: Game | null;

    constructor() {
        this.startTime = getTime();
        resourceLoader.setStageLoadedCallback((stage) => this.onStageLoaded(stage));
        resourceLoader.setResourceLoadedCallback(redrawLoadingBar);

        console.log(
            "\nCurious how the client works? " +
            "Check out the source: https://github.com/Sothatsit/RoyalUrClient\n "
        );
    }

    getActiveGame(): Game | null {
        return this.game || null;
    }

    setActiveGame(game: Game | null): void {
        this.game = game;
    }

    /**
     * The resource loading is split into stages that are used
     * to prioritise more vital resources before others.
     */
    onStageLoaded(stage) {
        if (stage === 0) {
            this.setup();
        } else if (stage === 1) {
            setupGameElements();
        }
        resize();
        maybeSwitchOffLoadingScreen(stage);
    }

    setup() {
        this.menuResourcesLoadedTime = getTime();

        imageSystem.populateDynamicImages();
        setupMenuElements();
        setInterval(updateRenderStatistics, 1000);

        document.addEventListener("keyup", handleKeyPress);
        window.onhashchange = onHashChange;
        onHashChange();

        window.requestAnimationFrame(() => {
            resize();
            redrawLoop();
            this.finishSetup();
        });
        window.onbeforeunload = (e) => this.onBeforeUnload(e);
    }

    finishSetup() {
        this.clientFinishSetupTime = getTime();

        if (debug) {
            this.reportStartupPerformance();
        }
    }

    reportStartupPerformance() {
        const startupDuration = this.clientFinishSetupTime - this.startTime,
              resourceLoadDuration = this.menuResourcesLoadedTime - this.startTime,
              setupDuration = this.clientFinishSetupTime - this.menuResourcesLoadedTime,
              resourceLoadPercentage = resourceLoadDuration / startupDuration,
              setupPercentage = setupDuration / startupDuration;

        let report = "\nClient startup took " + (Math.round(startupDuration * 1000 * 10) / 10) + "ms\n";
        report += "  " + (Math.round(resourceLoadPercentage * 1000) / 10) + "% - Resource Loading ";
        report += "(" + (Math.round(resourceLoadDuration * 1000 * 10) / 10) + "ms)\n";
        report += "  " + (Math.round(setupPercentage * 1000) / 10) + "% - Setup ";
        report += "(" + (Math.round(setupDuration * 1000 * 10) / 10) + "ms)\n ";
        console.log(report);
    }

    getReloadConfirmation() {
        if (!isOnScreen(SCREEN_GAME) && screenState.exitTargetScreen !== SCREEN_GAME)
            return null;
        const game = this.getActiveGame();
        if (!game || !game.exitLosesGame)
            return "Are you sure you wish to exit?";
        return "Your game will be lost if you exit. Are you sure you wish to exit?";
    }

    getExitConfirmation() {
        if (!isOnScreen(SCREEN_GAME))
            return null;
        const game = this.getActiveGame();
        if (!game || !game.exitLosesGame)
            return "Are you sure you wish to exit?";
        return "Your game will be lost if you exit. Are you sure you wish to exit?";
    }

    onBeforeUnload(event) {
        event = event || window.event;
        const message = this.getReloadConfirmation();
        if (!message)
            return;

        event.preventDefault();
        event.returnValue = message;
        return message;
    }
}
export const client: Client = new Client();



//
// Menu interaction.
//

export function onPlayClicked(event) {
    if (gameSetup.mode === null) {
        audioSystem.playSound("error");
        return;
    }

    switch (gameSetup.mode) {
        case GAME_MODE_LOCAL:
            window.game = new LocalGame();
            switchToScreen(SCREEN_GAME);
            break;

        case GAME_MODE_COMPUTER:
            if (!gameSetup.difficulty) {
                audioSystem.playSound("error");
                return;
            }

            window.game = new ComputerGame(gameSetup.difficulty);
            switchToScreen(SCREEN_GAME);
            break;

        case GAME_MODE_ONLINE:
            window.game = new OnlineGame();
            switchToScreen(SCREEN_CONNECTING);
            break;

        case GAME_MODE_FRIEND:
            window.game = new FriendGame();
            switchToScreen(SCREEN_CONNECTING);
            break;

        default:
            audioSystem.playSound("error");
            break;
    }
}

function onExitClick(event) {
    event.stopPropagation();

    const message = getExitConfirmation();
    if (message && !window.confirm(message))
        return;

    switchToScreen(screenState.exitTargetScreen);
}



//
// Establishing a network connection.
//

function onNetworkConnecting() {
    if(networkStatus.status === "Lost connection")
        return;

    setNetworkStatus("Connecting", true);
}
setNetworkConnectingHandler(onNetworkConnecting);


function onNetworkConnected() {
    resetGame();

    setNetworkStatus("Connected", false);
    fadeNetworkStatusOut();

    const gameID = getHashGameID();
    if (gameID !== null) {
        sendPacket(writeJoinGamePacket(gameID));
    } else {
        game.sendOpenGamePacket();
    }
}
setNetworkConnectedHandler(onNetworkConnected);


function onNetworkLoseConnection() {
    setNetworkStatus("Lost connection", true);
    fadeNetworkStatusIn();
}
setNetworkLostConnectionHandler(onNetworkLoseConnection);


function onNetworkDisconnect() {
    resetNetworkStatus();
    fadeNetworkStatusOut();
}
setNetworkDisconnectHandler(onNetworkDisconnect);



//
// Interactions with a networked game.
//

function onPacketError(data: {[key: string]: any}) {
    setMessage("An unexpected error occurred", "", true, 0, 2, 1)
    console.error("Error: " + data.error);
}
registerPacketHandler("error", onPacketError);


function onPacketInvalidGame(data: {[key: string]: any}) {
    disconnect();
    resetNetworkStatus();
    switchToScreen(SCREEN_MENU, true);
    setMessage("Your game could not be found", "", true, 0, 5, 1)
}
registerPacketHandler("invalid_game", onPacketInvalidGame);


function onPacketGamePending(gameInfo: {[key: string]: any}) {
    setHash(gameInfo.gameID);
    switchToScreen(SCREEN_WAITING_FOR_FRIEND);
}
registerPacketHandler("game_pending", onPacketGamePending);


function onPacketGame(gameInfo: {[key: string]: any}) {
    setHash(gameInfo.gameID);
    setOwnPlayer(gameInfo.ownPlayer);
    lightPlayer.name = gameInfo.lightName;
    lightPlayer.connected = gameInfo.lightConnected;
    darkPlayer.name = gameInfo.darkName;
    darkPlayer.connected = gameInfo.darkConnected;

    if (lightPlayer.name === "unknown" || lightPlayer.name.trim().length === 0) {
        lightPlayer.name = "Light";
    }
    if (darkPlayer.name === "unknown" || darkPlayer.name.trim().length === 0) {
        darkPlayer.name = "Dark";
    }

    switchToScreen(SCREEN_GAME);
    // If the user has been waiting a while to find a game, notify them with a sound!
    if (getTime() - networkConnectTime > 3) {
        audioSystem.playSound("game_found", null, true);
    }
}
registerPacketHandler("game", onPacketGame);


function onPacketGameEnd(data: {[key: string]: any}) {
    if (game == null)
        return;

    game = null;
    setMessage("Your game ended ", data.reason, true, 0, 5, 1);
    switchToScreen(SCREEN_MENU);
}
registerPacketHandler("game_end", onPacketGameEnd);


function onPacketMessage(data: {[key: string]: any}) {
    game.onPacketMessage(data);
}
registerPacketHandler("message", onPacketMessage);


function onPacketPlayerStatus(data: {[key: string]: any}) {
    if (game != null) {
        game.onPacketPlayerStatus(data);
    }
}
registerPacketHandler("player_status", onPacketPlayerStatus);


function onPacketMove(move: {[key: string]: any}) {
    game.onPacketMove(move);
}
registerPacketHandler("move", onPacketMove);


function onPacketState(state: {[key: string]: any}) {
    game.onPacketState(state);
}
registerPacketHandler("state", onPacketState);



//
// Game hash handling.
//

function getHashRaw() {
    if (!window.location.hash)
        return "";
    return window.location.hash.substr(1);
}

function setHash(hash) {
    if (getHashRaw() === hash)
        return;
    history.pushState(null, "Royal Ur", "#" + hash);
}

function resetHash() {
    setHash("");
}

function getHashGameID() {
    const gameID = getHashRaw();
    if (gameID.length !== GAME_ID_LENGTH) {
        resetHash();
        return null;
    }
    return gameID;
}

function onHashChange() {
    if (getHashGameID() !== null) {
        connectToGame(new FriendGame());
    } else {
        switchToScreen(SCREEN_MENU);
    }
}

function connectToGame(newGame) {
    game = newGame;
    switchToScreen(SCREEN_CONNECTING);
}


//
// Game interactions.
//

const KEY_SPACE = [" ", "Space", 32],
      KEY_ESCAPE = ["Escape", "Esc", 27],
      KEY_ENTER = ["Enter", 13],
      KEY_Q = ["q", "KeyQ", 81];

function isKey(event, key) {
    const keyCode = event.key || event.keyCode;
    for (let index = 0; index < key.length; ++index) {
        if (keyCode === key[index])
            return true;
    }
    return false;
}

function handleKeyPress(event) {
    if (event.defaultPrevented)
        return;

    // Pressing any key while a message is shown will dismiss that message.
    if (tryDismissMessage())
        return;

    if (isKey(event, KEY_SPACE)) {
        tryTakeSingleAction(event, true);
        return;
    }
    if (isKey(event, KEY_ENTER) || isKey(event, KEY_Q)) {
        tryTakeSingleAction(event, false);
        return;
    }
    if (isKey(event, KEY_ESCAPE)) {
        if (screenState.exitControlFade.isFadeIn()) {
            onExitClick(event);
        }
    }
}

/** If there is a message on the screen, fade it out. **/
function tryDismissMessage() {
    if (message.dismissable && message.fade.isFadeIn() && message.fade.get() > 0.5) {
        message.fade.fadeOut();
        if (game) {
            game.onMessageDismissed(message.title, message.subtitle);
        }
        return true;
    } else {
        return false;
    }
}

function tryTakeSingleAction(event, keyIsSpace) {
    if (!game)
        return false;

    event.stopPropagation();
    // Try roll the dice.
    if (game.onDiceClick())
        return true;

    // Check that the player can make a move.
    const currentPlayer = getActivePlayer();
    if (!currentPlayer || !isAwaitingMove())
        return false;

    // See if there is a single tile that can be moved, or if space is pressed any available moves.
    const availableMoves = board.getAllValidMoves(currentPlayer.playerNo, countDiceUp());
    if (availableMoves.length === 0)
        return false;

    // Sort the available moves so that they are in a predictable order.
    const playerPath = getTilePath(currentPlayer.playerNo);
    availableMoves.sort(function(from1, from2) {
        return vecListIndexOf(playerPath, from1) - vecListIndexOf(playerPath, from2);
    });

    // If space is pressed we cycle through available tiles to move.
    if (keyIsSpace && availableMoves.length > 1) {
        const selectedIndex = vecListIndexOf(availableMoves, selectedTile),
              selectIndex = (selectedIndex + 1) % availableMoves.length;
        selectTile(availableMoves[selectIndex]);
        return true;
    }

    // If there is one available move, or enter is pressed, try move the selected tile.
    if (!isTileSelected()) {
        if (availableMoves.length === 1) {
            selectTile(availableMoves[0]);
            return true;
        }
        return false;
    }
    game.performMove(selectedTile);
    return true;
}
