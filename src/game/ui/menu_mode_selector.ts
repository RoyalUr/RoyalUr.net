//
// This class contains the logic for the game mode selection UI.
//

import {MenuOptionElem, MenuOptionState, MenuSelectElem} from "@/game/ui/menu";
import {GameMode} from "@/game/model/game_model";


export class ModeSelectElem extends MenuSelectElem<ModeOptionElem> {

    static readonly ID_PREFIX = "mode";

    constructor() {
        super(ModeSelectElem.ID_PREFIX);
    }

    static createDefault(): ModeSelectElem {
        const modeSelect = new ModeSelectElem();
        modeSelect.addOption(new ModeOptionElem(
            modeSelect, GameMode.LOCAL, "local", "Two players on one computer."
        ));
        modeSelect.addOption(new ModeOptionElem(
            modeSelect, GameMode.COMPUTER, "computer", "Try your luck against the computer."
        ));
        modeSelect.addOption(new ModeOptionElem(
            modeSelect, GameMode.ONLINE, "online", "Play people across the globe."
        ));
        modeSelect.addOption(new ModeOptionElem(
            modeSelect, GameMode.FRIEND, "friend", "Play with a friend over the internet."
        ));
        return modeSelect;
    }
}

export class ModeOptionElem extends MenuOptionElem {

    mode: GameMode;

    constructor(parent: MenuSelectElem<any>, mode: GameMode, name: string, desc: string) {
        super(parent, ModeSelectElem.ID_PREFIX, name, desc);
        this.mode = mode;
    }

    getState(): MenuOptionState {
        return MenuOptionState.AVAILABLE;
    }
}
