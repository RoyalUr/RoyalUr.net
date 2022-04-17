//
// This file contains the logic of the elements on the game setup menu.
//


import {formatUnicorn, jumpToID, setElementClass, setElemOpacity} from "@/common/utils";
import {Fade, FadeDirection} from "@/common/fades";
import {ModeSelectElem} from "@/game/ui/menu_mode_selector";
import {ComputerSelectElem} from "@/game/ui/menu_computer_selector";
import {onPlayClicked} from "@/game/client";
import {gameSetup} from "@/game/model/game_model";
import {computerWorker} from "@/game/game/ai_worker_invoker";


/**
 * The setup menu for starting games.
 */
export class GameSetupMenu {

    readonly elem: HTMLElement;
    readonly playButton: HTMLElement;

    readonly modeSelect: ModeSelectElem;
    readonly computerSelect: ComputerSelectElem;

    readonly computerFade: Fade;
    readonly playFade: Fade;

    constructor(modeSelect: ModeSelectElem, computerSelect: ComputerSelectElem) {
        this.elem = document.getElementById("menu");
        this.playButton = document.getElementById("play");
        this.modeSelect = modeSelect;
        this.computerSelect = computerSelect;
        this.computerFade = new Fade(0);
        this.playFade = new Fade(0);

        this.modeSelect.addSelectionListener(option => {
            gameSetup.mode = option.metadata.mode;
            if (option.name === "computer") {
                setTimeout(() => jumpToID("computer-select"), 100);
                computerWorker.load();
            } else {
                jumpToID("top");
            }
        });
        this.computerSelect.addSelectionListener(option => {
            gameSetup.difficulty = option.metadata.difficulty;
            setTimeout(() => jumpToID("play"), 100);
        });
        this.playButton.addEventListener("click", onPlayClicked);
    }

    redraw() {
        const selectedMode = this.modeSelect.getSelectedOption(),
              selectedComputer = this.computerSelect.getSelectedOption();
        this.computerFade.fadeInOrOut(selectedMode && selectedMode.name === "computer");
        this.playFade.fadeInOrOut(selectedMode && (selectedMode.name !== "computer" || !!selectedComputer))

        setElemOpacity(this.elem, screenState.menuFade.get());
        setElemOpacity(this.computerSelect.elem, this.computerFade.get());
        setElemOpacity(this.playButton, this.playFade.get());

        this.modeSelect.redraw();
        this.computerSelect.redraw();
    }

    resize() {
        // Nothing to do.
    }

    reset() {
        this.modeSelect.clearSelected();
        this.computerSelect.clearSelected();
    }

    updateStates() {
        this.modeSelect.updateStates();
        this.computerSelect.updateStates();
    }

    static createDefault(): GameSetupMenu {
        return new GameSetupMenu(
            ModeSelectElem.createDefault(),
            ComputerSelectElem.createDefault()
        );
    }
}


type SelectListener = (option: MenuOptionElem) => void;

export enum MenuOptionState {
    AVAILABLE,
    LOADING,
    UNSUPPORTED,
}

/**
 * A menu element that allows the user to select
 * between several different options.
 */
export class MenuSelectElem<Option extends MenuOptionElem> {

    readonly elem: HTMLElement;
    readonly descElem: HTMLElement;
    readonly options: Option[];

    readonly loadingDesc: string;
    readonly unsupportedDesc: string;
    readonly allUnsupportedDesc: string;

    readonly selectListeners: SelectListener[];
    readonly descriptionFade: Fade;

    constructor(
            idPrefix: string, loadingDesc?: string,
            unsupportedDesc?: string, allUnsupportedDesc?: string) {

        this.elem = document.getElementById(idPrefix + "-select");
        this.descElem = document.getElementById(idPrefix + "-select-description-text");
        this.options = [];

        this.loadingDesc = loadingDesc ? loadingDesc : "The {name} option is loading...";
        this.unsupportedDesc = unsupportedDesc ? unsupportedDesc : "The {name} option is unsupported";
        this.allUnsupportedDesc = allUnsupportedDesc ? allUnsupportedDesc : "All options are unsupported :(";

        this.selectListeners = [];
        this.descriptionFade = new Fade(0.2);
    }

    addOption(option: Option) {
        this.options.push(option);
    }

    addSelectionListener(callback) {
        this.selectListeners.push(callback);
    }

    onSelect(option) {
        for (let index = 0; index < this.selectListeners.length; ++index) {
            this.selectListeners[index](option);
        }
    }

    clearSelected() {
        for (let index = 0; index < this.options.length; ++index) {
            this.options[index].onDeselect(true);
        }
    }

    getHoveredOption() {
        return this.options.find(option => option.hovered);
    }

    getSelectedOption() {
        return this.options.find(option => option.selected);
    }

    areAllOptionsUnsupported() {
        return !this.options.find(option => option.getState() !== MenuOptionState.UNSUPPORTED);
    }

    getDescOption() {
        const hoveredOption = this.getHoveredOption(),
              selectedOption = this.getSelectedOption();
        return (hoveredOption ? hoveredOption : selectedOption);
    };

    updateStates() {
        for (let index = 0; index < this.options.length; ++index) {
            this.options[index].updateElem(true);
        }
        this.updateDesc();
    }

    updateDesc() {
        const selectedOption = this.getSelectedOption(),
            option = this.getDescOption();

        let showDesc = !!option,
            desc = "",
            state = MenuOptionState.AVAILABLE;

        if (!!option) {
            state = option.getState();
            if (state === MenuOptionState.LOADING) {
                desc = formatUnicorn(this.loadingDesc, {name: option.name});
            } else if (state === MenuOptionState.UNSUPPORTED) {
                desc = formatUnicorn(this.unsupportedDesc, {name: option.name});
            } else {
                desc = option.desc;
            }
        } else if (this.areAllOptionsUnsupported()) {
            showDesc = true;
            desc = this.allUnsupportedDesc;
            state = MenuOptionState.UNSUPPORTED;
        }

        if (desc !== "") {
            this.descElem.innerHTML = desc;
        }
        this.descriptionFade.fade(showDesc ? FadeDirection.IN : FadeDirection.OUT);
        setElementClass(this.descElem, "option-loading", state === MenuOptionState.LOADING);
        setElementClass(this.descElem, "option-unsupported", state === MenuOptionState.UNSUPPORTED);
        setElementClass(this.elem, "inactive", !!selectedOption);
    }

    redraw() {
        setElemOpacity(this.descElem, this.descriptionFade.get());
    }
}


/**
 * An option that can be selected as part of a MenuSelectElem.
 */
export abstract class MenuOptionElem {

    readonly parent: MenuSelectElem<any>;
    readonly elem: HTMLElement;
    readonly name: string;
    readonly desc: string;

    hovered: boolean = false;
    selected: boolean = false;

    protected constructor(parent: MenuSelectElem<any>, idPrefix: string, name: string, desc: string) {
        this.parent = parent;
        this.elem = document.getElementById(idPrefix + "-" + name);
        this.name = name;
        this.desc = desc;
    }

    abstract getState(): MenuOptionState;

    onSelect() {
        if (this.selected || this.getState() !== MenuOptionState.AVAILABLE)
            return;

        this.parent.clearSelected();
        this.selected = true;
        this.updateElem();
        this.parent.onSelect(this);
    }

    onDeselect(skipUpdateDesc?: boolean) {
        if (!this.selected)
            return;

        this.selected = false;
        this.updateElem(skipUpdateDesc);
    }

    onHover() {
        if (this.hovered)
            return;

        this.hovered = true;
        this.updateElem();
    }

    onUnhover() {
        if (!this.hovered)
            return;

        this.hovered = false;
        this.updateElem();
    }

    updateElem(skipUpdateDesc?: boolean) {
        const state = this.getState();
        setElementClass(this.elem, "option-loading", state === MenuOptionState.LOADING);
        setElementClass(this.elem, "option-unsupported", state === MenuOptionState.UNSUPPORTED);
        setElementClass(this.elem, "option-selected", this.selected);
        setElementClass(this.elem, "option-hovered", state === MenuOptionState.AVAILABLE && this.hovered);
        if (!skipUpdateDesc) {
            this.parent.updateDesc();
        }
    }
}
