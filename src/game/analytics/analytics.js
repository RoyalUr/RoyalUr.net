//
// This file contains logic related to recording
// analytics about how users interact with the game.
//
// NOTE: If users have "Do Not Track" set in their browsers,
//       none of these analytics will be recorded.
//
// See: https://matomo.org
//

// Events related to the users connection to the server.
const EVENT_CATEGORY_CONNECTION = "connection",
      EVENT_ACTION_CONNECTION_FAILED = "connection_failed",
      EVENT_ACTION_CONNECTED = "connected",
      EVENT_ACTION_LOSE_CONNECTION = "lose_connection",
      EVENT_ACTION_CLOSE_CONNECTION = "close_connection";

// Events related to the playing of games.
const EVENT_CATEGORY_GAMES = "games",
      EVENT_ACTION_SEARCH_FOR_GAME = "search_for_game",
      EVENT_ACTION_CREATE_GAME = "create_game",
      EVENT_ACTION_START_GAME = "start_game",
      EVENT_ACTION_ABORT_GAME = "abort_game",
      EVENT_ACTION_FINISH_GAME = "finish_game",
      EVENT_LOCAL_GAME = "local_game",
      EVENT_COMPUTER_GAME = "computer_game",
      EVENT_COMPUTER_GAME_UNKNOWN = EVENT_COMPUTER_GAME + "_unknown",
      EVENT_COMPUTER_GAME_EASY = EVENT_COMPUTER_GAME + "_easy",
      EVENT_COMPUTER_GAME_MEDIUM = EVENT_COMPUTER_GAME + "_medium",
      EVENT_COMPUTER_GAME_HARD = EVENT_COMPUTER_GAME + "_hard",
      EVENT_COMPUTER_GAME_PANDA = EVENT_COMPUTER_GAME + "_panda",
      EVENT_ONLINE_GAME = "online_game",
      EVENT_FRIEND_GAME = "friend_game";

function Analytics() {
    this.__class_name__ = "Analytics";
    this.lastConnectionEventAction = null;
}
Analytics.prototype.recordEvent = function(category, action, name, value) {
    if (!category || !action)
        throw "must specify category and action";

    const event = ['trackEvent', category, action];
    if (name) {
        event.push(name);
        if (value) {
            event.push(value);
        }
    } else if (!value) {
        throw "cannot specify a value without an event name";
    }

    // Report the event to the Matomo analytics.
    printDebug("Analytics: Recording event [" + event.join(", ") + "]");
    (window._paq || []).push(event);
}
Analytics.prototype.recordConnectionEvent = function(action, name, value) {
    // We ignore repeated connection events.
    if (this.lastConnectionEventAction === action)
        return;

    this.lastConnectionEventAction = action;
    this.recordEvent(EVENT_CATEGORY_CONNECTION, action, name, value);
};
Analytics.prototype.recordConnectionFailed = function(targetURL) {
    this.recordConnectionEvent(EVENT_ACTION_CONNECTION_FAILED, targetURL);
};
Analytics.prototype.recordConnected = function(targetURL) {
    this.recordConnectionEvent(EVENT_ACTION_CONNECTED, targetURL);
};
Analytics.prototype.recordLoseConnection = function(targetURL) {
    this.recordConnectionEvent(EVENT_ACTION_LOSE_CONNECTION, targetURL);
};
Analytics.prototype.recordCloseConnection = function(targetURL) {
    this.recordConnectionEvent(EVENT_ACTION_CLOSE_CONNECTION, targetURL);
};

Analytics.prototype.recordStartGame = function(gameType) {
    this.recordEvent(EVENT_CATEGORY_GAMES, EVENT_ACTION_START_GAME, gameType);
};
Analytics.prototype.recordAbortGame = function(gameType) {
    this.recordEvent(EVENT_CATEGORY_GAMES, EVENT_ACTION_ABORT_GAME, gameType);
};
Analytics.prototype.recordFinishGame = function(gameType) {
    this.recordEvent(EVENT_CATEGORY_GAMES, EVENT_ACTION_FINISH_GAME, gameType);
};

Analytics.prototype.recordSearchForOnlineGame = function() {
    this.recordEvent(EVENT_CATEGORY_GAMES, EVENT_ACTION_SEARCH_FOR_GAME, EVENT_ONLINE_GAME);
};
Analytics.prototype.recordCreateGame = function() {
    this.recordEvent(EVENT_CATEGORY_GAMES, EVENT_ACTION_CREATE_GAME, EVENT_FRIEND_GAME);
};

const analytics = new Analytics();
