//
// This file stores the logic for playing online friend games.
//

import {analytics, EventName} from "@/game/analytics/analytics";
import {OnlineGame} from "@/game/game/online_game";
import {sendPacket} from "@/game/network/network";
import {writeCreateGamePacket} from "@/game/network/network_packets";


export class FriendGame extends OnlineGame {

    protected constructor() {
        super(EventName.FRIEND_GAME);
    }

    override sendOpenGamePacket() {
        analytics.recordCreateGame();
        sendPacket(writeCreateGamePacket());
    }
}
