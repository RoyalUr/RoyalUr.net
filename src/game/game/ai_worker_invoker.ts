import {aiPackets} from "@/game/network/ai_packets";
import {ComputerGame} from "@/game/game/computer_game";
import {client} from "@/game/client";


export type ComputerWorkerSupportListener = (ComputerWorker) => void;

export class ComputerWorker {

    readonly supportListeners: ComputerWorkerSupportListener[]
    worker: Worker = null;

    available: boolean;
    unsupported: boolean;
    pandaAvailable: boolean;
    pandaUnsupported: boolean;

    private invokeSupportListeners() {
        for (let index = 0; index < this.supportListeners.length; ++index) {
            this.supportListeners[index](this);
        }
    }

    load() {
        if (this.worker !== null || this.unsupported)
            return;

        try {
            this.worker = new Worker("/game/computer_worker.[ver].js");
            this.worker.onmessage = event => this.onMessage(event);
        } catch (e) {
            this.unsupported = true;
            this.pandaUnsupported = true;
            this.invokeSupportListeners();
        }
    }

    get(): Worker {
        this.load();
        return this.worker;
    }

    postMessage(message: string) {
        this.worker.postMessage(message);
    }

    onMessage(event: MessageEvent) {
        const packet = aiPackets.readPacket(event.data);

        if (packet.type === "ai_functionality") {
            this.available = packet.available;
            this.pandaAvailable = packet.pandaAvailable;
            this.pandaUnsupported = packet.pandaUnsupported;
            this.invokeSupportListeners();
        } else if (packet.type === "ai_move_response") {
            // See if the current game is waiting for a computer move.
            const game = client.getActiveGame();
            if (game && game instanceof ComputerGame) {
                game.onReceiveComputerMove(packet.moveFrom);
            }
        } else {
            throw "Unsupported packet type " + packet.type;
        }
    }
}

export const computerWorker: ComputerWorker = new ComputerWorker();
