//
// This file contains the logic of the elements on the game setup menu.
//


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
            setTimeout(() => jumpToID("computer-select"), 100)
        } else {
            jumpToID("top");
        }
    });

    this.computerSelect = new MenuSelectElem(
        "computer",
        [
            {"name": "easy",   "desc": "Good for beginners to the game.",        "difficulty": DIFFICULTY_EASY},
            {"name": "medium", "desc": "Challenging to beat.",                   "difficulty": DIFFICULTY_MEDIUM},
            {"name": "hard",   "desc": "Ruthless and very challenging to beat.", "difficulty": DIFFICULTY_HARD},
            // {"name": "panda",  "desc": "The panda is world-class... good luck.", "difficulty": DIFFICULTY_PANDA},
        ]
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
    this.modeSelect.resize();
    this.computerSelect.resize();
};
GameSetupMenu.prototype.reset = function() {
    resetGameSetup();
    this.modeSelect.clearSelected();
    this.computerSelect.clearSelected();
};


/**
 * A menu element that allows the user to select
 * between several different options.
 */
function MenuSelectElem(idPrefix, optionMetadatas) {
    this.__class_name__ = "MenuSelectElem";
    this.elem = document.getElementById(idPrefix + "-select");
    this.description = document.getElementById(idPrefix + "-select-description");
    this.descriptionText = document.getElementById(idPrefix + "-select-description-text");
    this.descriptionFade = new Fade(0.5);

    // Create a canvas to use to measure the width of descriptions.
    this.descWidthCtx = document.createElement("canvas").getContext("2d");

    this.options = [];
    for (let index = 0; index < optionMetadatas.length; ++index) {
        const optionMeta = optionMetadatas[index];
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
MenuSelectElem.prototype.getDescOption = function() {
    const hoveredOption = this.getHoveredOption(),
          selectedOption = this.getSelectedOption();
    return (hoveredOption ? hoveredOption : selectedOption);
};
MenuSelectElem.prototype.updateDesc = function() {
    const selectedOption = this.getSelectedOption(),
          option = this.getDescOption();

    if (!!option) {
        this.descriptionText.textContent = option.desc;
    }
    this.descriptionFade.fade(!!option);
    setElementClass(this.elem, "inactive", !!selectedOption);
    this.positionDesc();
};
MenuSelectElem.prototype.positionDesc = function() {
    const option = this.getDescOption();
    if (!option)
        return;

    // Just center the description text if finding the width of text is not supported,
    // or if the options are split over multiple lines.
    if (!window.getComputedStyle || !this.descWidthCtx.measureText || 3 * height > 4 * width) {
        this.description.style.width = "";
        this.description.style.marginLeft = "";
        this.description.style.marginRight = "";
        return;
    }

    // Try to position the description text below the option.
    const optionBounds = option.elem.getBoundingClientRect(),
          centerX = optionBounds.x + optionBounds.width / 2,
          descWidth = this.calcDescWidth(option.desc) * 1.05,
          widthVW = Math.max(100 * descWidth / width, 100 - 200 * Math.abs(width / 2 - centerX) / width),
          offsetVW = 100 - widthVW;

    this.description.style.width = widthVW + "vw";
    if (centerX < width / 2) {
        this.description.style.marginLeft = "";
        this.description.style.marginRight = offsetVW + "vw";
    } else {
        this.description.style.marginLeft = offsetVW + "vw";
        this.description.style.marginRight = "";
    }
};
MenuSelectElem.prototype.calcDescWidth = function(desc) {
    const styles = window.getComputedStyle(this.descriptionText, null);
    this.descWidthCtx.font = styles.getPropertyValue("font");
    return this.descWidthCtx.measureText(desc).width;
};
MenuSelectElem.prototype.redraw = function() {
    this.description.style.opacity = this.descriptionFade.get();
};
MenuSelectElem.prototype.resize = function() {
    this.positionDesc();
};


/**
 * An option that can be selected as part of a MenuSelectElem.
 */
function MenuSelectOptionElem(parent, idPrefix, metadata) {
    this.__class_name__ = "MenuSelectOptionElem";
    this.parent = parent;
    this.name = metadata.name;
    this.desc = metadata.desc;
    this.metadata = metadata;
    this.elem = document.getElementById(idPrefix + "-" + this.name);
    this.hovered = false;
    this.selected = false;

    this.elem.addEventListener("click", this.onSelect.bind(this));
    this.elem.addEventListener("mouseover", this.onHover.bind(this));
    this.elem.addEventListener("mouseout", this.onUnhover.bind(this));
}
MenuSelectOptionElem.prototype.onSelect = function() {
    if (this.selected)
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
    setElementClass(this.elem, "option-selected", this.selected);
    setElementClass(this.elem, "option-hovered", this.hovered);
    if (!skipUpdateDesc) {
        this.parent.updateDesc();
    }
};
