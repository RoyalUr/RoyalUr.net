//
// This class contains the logic for the computer difficulty selection UI.
//

import {MenuOptionElem, MenuOptionState, MenuSelectElem} from "@/game/ui/menu";
import {ComputerDifficulty} from "@/game/game/computer_game";
import {computerWorker} from "@/game/game/ai_worker_invoker";


export class ComputerSelectElem extends MenuSelectElem<ComputerOptionElem> {

    static readonly ID_PREFIX = "computer";

    constructor() {
        super(ComputerSelectElem.ID_PREFIX);
    }

    static createDefault(): ComputerSelectElem {
        const computerSelect = new ComputerSelectElem();
        computerSelect.addOption(new JSComputerOptionElem(
            computerSelect, ComputerDifficulty.EASY, "easy", "Good for beginners to the game."
        ));
        computerSelect.addOption(new JSComputerOptionElem(
            computerSelect, ComputerDifficulty.MEDIUM, "medium", "Challenging to beat."
        ));
        computerSelect.addOption(new JSComputerOptionElem(
            computerSelect, ComputerDifficulty.HARD, "hard", "Ruthless and very challenging to beat."
        ));
        computerSelect.addOption(new WASMComputerOptionElem(
            computerSelect, ComputerDifficulty.PANDA, "extreme", "The extreme difficulty is world-class... good luck!"
        ));
        return computerSelect;
    }
}

export abstract class ComputerOptionElem extends MenuOptionElem {

    difficulty: ComputerDifficulty;

    constructor(parent: ComputerSelectElem, difficulty: ComputerDifficulty, name: string, desc: string) {
        super(parent, ComputerSelectElem.ID_PREFIX, name, desc);
        this.difficulty = difficulty;
    }
}

class JSComputerOptionElem extends ComputerOptionElem {
    getState(): MenuOptionState {
        if (computerWorker.available)
            return MenuOptionState.AVAILABLE;
        return computerWorker.unsupported ? MenuOptionState.UNSUPPORTED : MenuOptionState.LOADING;
    }
}

class WASMComputerOptionElem extends ComputerOptionElem {
    getState(): MenuOptionState {
        if (computerWorker.pandaAvailable)
            return MenuOptionState.AVAILABLE;
        return computerWorker.pandaUnsupported ? MenuOptionState.UNSUPPORTED : MenuOptionState.LOADING;
    }
}
