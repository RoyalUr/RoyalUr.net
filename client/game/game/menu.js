//
// This file contains the logic of the elements on the game setup menu.
//


const OPT_AVAILABLE = "menu_option_available",
      OPT_LOADING = "menu_option_loading",
      OPT_UNSUPPORTED = "menu_option_unsupported";


/**
 * The setup menu for starting games.
 */
function GameSetupMenu() {
    this.__class_name__ = "GameSetupMenu";

    this.elem = document.getElementById("menu");
    this.modeSelect = new MenuSelectElem(
        "mode",
        [
            {"name": "local",    "desc": "Two players on one computer.",          "mode": GAME_MODE_LOCAL},
            {"name": "computer", "desc": "Try your luck against the computer.",   "mode": GAME_MODE_COMPUTER},
            {"name": "online",   "desc": "Play people across the globe.",         "mode": GAME_MODE_ONLINE},
            {"name": "friend",   "desc": "Play with a friend over the internet.", "mode": GAME_MODE_FRIEND}
        ]
    );
    this.modeSelect.addSelectionListener(option => {
        gameSetup.mode = option.metadata.mode;
        if (option.name === "computer") {
            setTimeout(() => jumpToID("computer-select"), 100);
            loadComputerWorker();
        } else {
            jumpToID("top");
        }
    });

    // The function that determines if the standard difficulty levels are available or loading.
    const standardStateFn = () => {
        if (computerAvailable)
            return OPT_AVAILABLE;
        return computerUnsupported ? OPT_UNSUPPORTED : OPT_LOADING;
    };
    this.computerSelect = new MenuSelectElem(
        "computer",
        [
            {
                "name": "easy",
                "desc": "Good for beginners to the game.",
                "difficulty": DIFFICULTY_EASY,
                "stateFn": standardStateFn
            },
            {
                "name": "medium",
                "desc": "Challenging to beat.",
                "difficulty": DIFFICULTY_MEDIUM,
                "stateFn": standardStateFn
            },
            {
                "name": "hard",
                "desc": "Ruthless and very challenging to beat.",
                "difficulty": DIFFICULTY_HARD,
                "stateFn": standardStateFn
            },
            {
                "name": "extreme",
                "desc": "The extreme difficulty is world-class... good luck!",
                "difficulty": DIFFICULTY_PANDA,
                "stateFn": () => {
                    if (computerPandaAvailable)
                        return OPT_AVAILABLE;
                    return computerPandaUnsupported ? OPT_UNSUPPORTED : OPT_LOADING;
                }
            },
        ],
        "The {name} difficulty is loading...",
        "The {name} difficulty is not supported on your browser",
        "All computer difficulties are unsupported on your browser :("
    );
    this.computerSelect.addSelectionListener(option => {
        gameSetup.difficulty = option.metadata.difficulty;
        setTimeout(() => jumpToID("play"), 100);
    });

    this.playButton = document.getElementById("play");
    this.playButton.addEventListener("click", onPlayClicked);

    this.computerFade = new Fade(0.5);
    this.playFade = new Fade(0.5, 0);
}
GameSetupMenu.prototype.redraw = function() {
    const selectedMode = this.modeSelect.getSelectedOption(),
          selectedComputer = this.computerSelect.getSelectedOption();
    this.computerFade.fade(selectedMode && selectedMode.name === "computer");
    this.playFade.fade(selectedMode && (selectedMode.name !== "computer" || selectedComputer))

    this.elem.style.opacity = screenState.menuFade.get();
    this.computerSelect.elem.style.opacity = this.computerFade.get();
    this.playButton.style.opacity = this.playFade.get();

    this.modeSelect.redraw();
    this.computerSelect.redraw();

    updateElementVisibilities([this.computerSelect.elem, this.playButton]);
};
GameSetupMenu.prototype.resize = function() {
    // Nothing to do.
};
GameSetupMenu.prototype.reset = function() {
    resetGameSetup();
    this.modeSelect.clearSelected();
    this.computerSelect.clearSelected();
};
GameSetupMenu.prototype.updateStates = function() {
    this.modeSelect.updateStates();
    this.computerSelect.updateStates();
};


/**
 * A menu element that allows the user to select
 * between several different options.
 */
function MenuSelectElem(idPrefix, options, loadingDesc, unsupportedDesc, allUnsupportedDesc) {
    this.__class_name__ = "MenuSelectElem";
    this.elem = document.getElementById(idPrefix + "-select");
    this.descriptionText = document.getElementById(idPrefix + "-select-description-text");
    this.descriptionFade = new Fade(0.2);

    this.loadingDesc = (loadingDesc ? loadingDesc : "The {name} option is loading...");
    this.unsupportedDesc = (unsupportedDesc ? unsupportedDesc : "The {name} option is unsupported");
    this.allUnsupportedDesc = (allUnsupportedDesc ? allUnsupportedDesc : "All options are unsupported :(");

    this.options = [];
    for (let index = 0; index < options.length; ++index) {
        const optionMeta = options[index];
        this.options.push(new MenuSelectOptionElem(this, idPrefix, optionMeta));
    }

    this.selectListeners = [];
}
MenuSelectElem.prototype.addSelectionListener = function(callback) {
    this.selectListeners.push(callback);
};
MenuSelectElem.prototype.onSelect = function(option) {
    for (let index = 0; index < this.selectListeners.length; ++index) {
        this.selectListeners[index](option);
    }
};
MenuSelectElem.prototype.clearSelected = function() {
    for (let index = 0; index < this.options.length; ++index) {
        this.options[index].onDeselect(true);
    }
};
MenuSelectElem.prototype.getHoveredOption = function() {
    return this.options.find(option => option.hovered);
};
MenuSelectElem.prototype.getSelectedOption = function() {
    return this.options.find(option => option.selected);
};
MenuSelectElem.prototype.areAllOptionsUnsupported = function() {
    return !this.options.find(option => option.getState() !== OPT_UNSUPPORTED);
};
MenuSelectElem.prototype.getDescOption = function() {
    const hoveredOption = this.getHoveredOption(),
          selectedOption = this.getSelectedOption();
    return (hoveredOption ? hoveredOption : selectedOption);
};
MenuSelectElem.prototype.updateStates = function() {
    for (let index = 0; index < this.options.length; ++index) {
        this.options[index].updateElem(true);
    }
    this.updateDesc();
};
MenuSelectElem.prototype.updateDesc = function() {
    const selectedOption = this.getSelectedOption(),
          option = this.getDescOption();

    let showDesc = !!option,
        desc = "",
        state = OPT_AVAILABLE;

    if (!!option) {
        state = option.getState();
        if (state === OPT_LOADING) {
            desc = formatUnicorn(this.loadingDesc, {name: option.name});
        } else if (state === OPT_UNSUPPORTED) {
            desc = formatUnicorn(this.unsupportedDesc, {name: option.name});
        } else {
            desc = option.desc;
        }
    } else if (this.areAllOptionsUnsupported()) {
        showDesc = true;
        desc = this.allUnsupportedDesc;
        state = OPT_UNSUPPORTED;
    }

    if (desc !== "") {
        this.descriptionText.innerHTML = desc;
    }
    this.descriptionFade.fade(showDesc);
    setElementClass(this.descriptionText, "option-loading", state === OPT_LOADING);
    setElementClass(this.descriptionText, "option-unsupported", state === OPT_UNSUPPORTED);
    setElementClass(this.elem, "inactive", !!selectedOption);
};
MenuSelectElem.prototype.redraw = function() {
    this.descriptionText.style.opacity = this.descriptionFade.get();
};


/**
 * An option that can be selected as part of a MenuSelectElem.
 */
function MenuSelectOptionElem(parent, idPrefix, metadata) {
    this.__class_name__ = "MenuSelectOptionElem";
    this.parent = parent;
    this.name = metadata.name;
    this.desc = metadata.desc;
    this.getState = (metadata.stateFn ? metadata.stateFn : () => OPT_AVAILABLE);
    this.metadata = metadata;
    this.elem = document.getElementById(idPrefix + "-" + this.name);
    this.hovered = false;
    this.selected = false;

    this.elem.addEventListener("click", this.onSelect.bind(this));
    this.elem.addEventListener("mouseover", this.onHover.bind(this));
    this.elem.addEventListener("mouseout", this.onUnhover.bind(this));
}
MenuSelectOptionElem.prototype.onSelect = function() {
    if (this.selected || this.getState() !== OPT_AVAILABLE)
        return;

    this.parent.clearSelected();
    this.selected = true;
    this.updateElem();
    this.parent.onSelect(this);
};
MenuSelectOptionElem.prototype.onDeselect = function(skipUpdateDesc) {
    if (!this.selected)
        return;

    this.selected = false;
    this.updateElem(skipUpdateDesc);
};
MenuSelectOptionElem.prototype.onHover = function() {
    if (this.hovered)
        return;

    this.hovered = true;
    this.updateElem();
};
MenuSelectOptionElem.prototype.onUnhover = function() {
    if (!this.hovered)
        return;

    this.hovered = false;
    this.updateElem();
};
MenuSelectOptionElem.prototype.updateElem = function(skipUpdateDesc) {
    const state = this.getState();
    setElementClass(this.elem, "option-loading", state === OPT_LOADING);
    setElementClass(this.elem, "option-unsupported", state === OPT_UNSUPPORTED);
    setElementClass(this.elem, "option-selected", this.selected);
    setElementClass(this.elem, "option-hovered", state === OPT_AVAILABLE && this.hovered);
    if (!skipUpdateDesc) {
        this.parent.updateDesc();
    }
};
