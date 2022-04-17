//
// This file contains logic related to recording
// analytics about how users interact with the game.
//
// NOTE: If users have "Do Not Track" set in their browsers,
//       none of these analytics will be recorded.
//
// See: https://matomo.org
//

import {printDebug} from "@/game/network/network";

export enum EventCategory {
    GAMES = "games"
}
export enum EventAction {
    SEARCH_FOR_GAME = "search_for_game",
    CREATE_GAME = "create_game",
    START_GAME = "start_game",
    ABORT_GAME = "abort_game",
    FINISH_GAME = "finish_game"
}
export enum EventName {
    LOCAL_GAME = "local_game",
    ONLINE_GAME = "online_game",
    FRIEND_GAME = "friend_game",
    COMPUTER_GAME_UNKNOWN = "computer_game_unknown",
    COMPUTER_GAME_EASY = "computer_game_easy",
    COMPUTER_GAME_MEDIUM = "computer_game_medium",
    COMPUTER_GAME_HARD = "computer_game_hard",
    COMPUTER_GAME_PANDA = "computer_game_panda",
}


declare global {
    interface Window { _paq: any[]; }
}

class Analytics {
    recordEvent(category: EventCategory, action: EventAction, name?: EventName, value?: number) {
        const event: any[] = ['trackEvent', category, action];
        if (name) {
            event.push(name);
            if (value) {
                event.push(value);
            }
        } else if (value) {
            throw "cannot specify a value without an event name";
        }

        // Report the event to the Matomo analytics.
        printDebug("Analytics: Recording event [" + event.join(", ") + "]");
        (window._paq || []).push(event);
    }

    recordStartGame(gameType: EventName) {
        this.recordEvent(EventCategory.GAMES, EventAction.START_GAME, gameType);
    }
    recordAbortGame(gameType: EventName) {
        this.recordEvent(EventCategory.GAMES, EventAction.ABORT_GAME, gameType);
    }
    recordFinishGame(gameType: EventName) {
        this.recordEvent(EventCategory.GAMES, EventAction.FINISH_GAME, gameType);
    }

    recordSearchForOnlineGame() {
        this.recordEvent(EventCategory.GAMES, EventAction.SEARCH_FOR_GAME, EventName.ONLINE_GAME);
    }
    recordCreateGame() {
        this.recordEvent(EventCategory.GAMES, EventAction.CREATE_GAME, EventName.FRIEND_GAME);
    }
}

export const analytics = new Analytics();
