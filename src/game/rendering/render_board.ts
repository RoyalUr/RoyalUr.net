//
// This file contains the code to render the board and the tiles on it.
//

import {board, GameBoard, GamePlayers, players} from "@/game/model/game_model";
import {Vec2, Vec2List} from "@/common/vectors";
import {Board, Tile} from "@/game/game/board";
import {clamp, drawCircularShadow, getTime, min} from "@/common/utils";
import {AudioSystem} from "@/common/resources/audio_system";
import {audioSystem, imageSystem} from "@/game/game_resources";
import {ImageSystem} from "@/common/resources/image_system";
import {dice, Dice} from "@/game/model/dice_model";
import {tileToCanvas} from "@/game/ui/layout";


const TILE_MOVE_DURATIONS = [0, 0.3, 0.4, 0.5, 0.6],
      HOVER_WIDTH_RATIO = 1.1,
      SHADOW_WIDTH_RATIO = HOVER_WIDTH_RATIO * 1.05,
      DRAG_DIRECT_LINE_TILE_WIDTHS = 0.25;


export class BoardRenderer {

    private readonly board: GameBoard;
    private readonly players: GamePlayers;
    private readonly dice: Dice;
    private readonly audioSystem: AudioSystem;
    private readonly imageSystem: ImageSystem;

    private tilePathAnchorTime: number = 0;
    private tileMove: TileMoveRenderer = null;

    constructor(board: GameBoard, players: GamePlayers, dice: Dice, audioSystem: AudioSystem, imageSystem: ImageSystem) {
        this.board = board;
        this.players = players;
        this.audioSystem = audioSystem;
        this.imageSystem = imageSystem;
    }

    updateTilePathAnchorTime() {
        const duration = getTime() - mouseDownTime,
              width = getTileWidth(),
              distance = mouseLoc.dist(mouseDownLoc);

        // Adjust the anchor time based upon the time since the player started dragging
        // a tile, and the distance that they have dragged the tile.
        const newAnchorTime = this.tilePathAnchorTime + (9 / 15) * duration - (2 / 3) * distance / width;

        // Period in time when the pattern repeats.
        const period = 2 / 3;
        this.tilePathAnchorTime = (newAnchorTime % period) + (newAnchorTime < 0 ? period : 0);
    }

    runOnTileMoveFinish(onComplete: (from: Vec2, to: Vec2) => void) {
        if (this.tileMove === null) {
            onComplete(Vec2.NEG1, Vec2.NEG1);
            return;
        }
        this.tileMove.runOnFinish(onComplete);
    }

    animateTileMove(from: Vec2, to: Vec2, onComplete?: (from: Vec2, to: Vec2) => void) {
        if (this.tileMove)
            throw "There is already an active tile move";

        onComplete = (!onComplete ? null : onComplete);

        if (this.board.getTile(from) === Tile.EMPTY) {
            if (onComplete !== null) {
                onComplete(Vec2.NEG1, Vec2.NEG1);
            }
            return;
        }
        this.tileMove = new TileMoveRenderer(this.board, this.audioSystem, from, to);
    }

    /**
     * When a tile is dragged, we don't then want to animate it moving from its start
     * position. Therefore, this skips the tile movement, but keeps the other animation
     * for highlighting when a piece is moved onto a rosette.
     */
    animateTileDragMove(from: Vec2, to: Vec2, onComplete?: (from: Vec2, to: Vec2) => void) {
        this.animateTileMove(from, to, onComplete);
        if (this.tileMove) {
            this.tileMove.skipTileMovement();
        }
    }

    private updateTileMove(time: number) {
        if (!this.tileMove)
            return;

        const finished = this.tileMove.update(time);
        if (finished) {
            this.finishTileMove();
        }
    }

    private finishTileMove() {
        if (!this.tileMove)
            throw "There is no active tile move";

        const onComplete = this.tileMove.onComplete,
              from = this.tileMove.from,
              to = this.tileMove.to;

        this.tileMove = null;
        if (onComplete !== null) {
            onComplete(from, to);
        }
    }

    redrawBoard(forceRedraw: boolean) {
        if (!isOnScreen(GAME_VISIBLE_SCREENS) || !forceRedraw)
            return;

        const ctx = boardCtx;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 30;
        ctx.clearRect(0, 0, boardCanvasWidth, boardCanvasHeight);

        const boardImage = this.imageSystem.getImageResource("board", boardWidth);
        ctx.drawImage(boardImage, boardX, boardY, boardWidth, boardHeight);
    }

    redrawTiles(forceRedraw: boolean) {
        if (!isOnScreen(GAME_VISIBLE_SCREENS) || !forceRedraw)
            return;

        const ctx = tilesCtx,
              time = getTime();

        ctx.clearRect(0, 0, tilesWidth, tilesHeight);

        const tileWidth = getTileWidth(),
              path = Board.getPath(this.players.own.playerNo),
              diceValue = this.dice.count();

        // Get the tile to draw a path for.
        let pathStart = getDrawPotentialMoveTile(),
            pathStartIndex = path.indexOf(pathStart),
            pathEndIndex = (pathStartIndex >= 0 ? min(pathStartIndex + diceValue, path.length - 1) : -1),
            pathEnd = (pathEndIndex >= 0 ? path[pathEndIndex] : Vec2.NEG1);

        if(pathStartIndex === pathEndIndex) {
            pathStart = Vec2.NEG1;
            pathEnd = Vec2.NEG1;
        }

        // Get the tile we are currently moving
        this.updateTileMove(time);
        const moveFrom = this.tileMove.from,
              moveTo = this.tileMove.to;

        // Tiles we will draw later (or just don't want to draw).
        const ignoreDrawTiles: Vec2List = new Vec2List([pathStart, pathEnd, moveFrom, moveTo]);
        for (let index = 0; index < this.players.others.length; ++index) {
            ignoreDrawTiles.push(Board.getStart(this.players.others[index].playerNo));
        }

        // Draw all tiles that are not ignored.
        this.drawStationaryTiles(ctx, ignoreDrawTiles);

        // Draw a potential move.
        this.drawPotentialMove(ctx, pathStart, pathEnd, pathStartIndex, pathEndIndex, diceValue);

        // Draw the tile that is moving.
        drawMovingTile(ctx, time, tileWidth);
    }

    private drawStationaryTiles(ctx: CanvasRenderingContext2D, ignoreDrawTiles: Vec2List) {
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            const loc = Board.TILE_LOCS[index],
                tile = this.board.getTile(loc);

            if (tile === Tile.EMPTY || ignoreDrawTiles.contains(loc))
                continue;

            const tileDrawWidth = tileWidth * (loc.equals(hoveredTile) ? HOVER_WIDTH_RATIO : 1),
                shadowColour = (this.board.isSelected(loc) ? 255 : 0);

            renderTile(ctx, loc, tileDrawWidth, tileDrawWidth, tile, shadowColour);
        }
    }

    private drawPotentialMove(
            ctx: CanvasRenderingContext2D,
            start: Vec2, end: Vec2,
            startIndex: number, endIndex: number,
            diceValue: number) {

        if (!Board.isLocValid(start))
            return;

        const owner = this.players.own.playerNo,
              isValidMove = this.board.isValidMoveFrom(owner, start, diceValue),
              draggingTile = this.board.isSelected(draggedTile);

        // Find the location of the dragged tile
        let dragLoc = null;
        if (draggingTile) {
            dragLoc = tileToCanvas(start).add(mouseLoc).sub(mouseDownLoc);
            dragLoc.x = clamp(dragLoc.x, tileWidth, tilesWidth - tileWidth);
            dragLoc.y = clamp(dragLoc.y, tileWidth, tilesHeight - tileWidth);
        }

        // Convert the tile path to a canvas location curve
        const curve = computePathCurve(startIndex, endIndex);

        drawPath(ctx, time - tilePathAnchorTime, path[endIndex], curve, isValidMove, dragLoc);

        const endHovered = isTileHovered(endTile),
            tileHoverWidth = tileWidth * HOVER_WIDTH_RATIO,
            cyclicWidthMul = 1 + 0.03 * Math.cos(5 * time),
            tileCyclicWidth = tileHoverWidth * cyclicWidthMul;

        if(board.getTile(endTile) !== TILE_EMPTY) {
            const tileWidth = (isValidMove ? tileCyclicWidth : tileHoverWidth);
            renderTile(ctx, endTile, tileWidth, tileWidth, board.getTile(endTile), (endHovered ? 255 : 0));
        } else if(isValidMove) {
            renderTile(ctx, endTile, tileCyclicWidth, tileCyclicWidth, owner, (endHovered ? 255 : 0));
        }

        if(!draggingTile) {
            const shadowShade = (isTileSelected(pathTile) || isTileHovered(pathTile) ? 255 : 0);
            renderTile(ctx, pathTile, tileHoverWidth, tileHoverWidth, owner, shadowShade);
        } else {
            if (dragLoc === null)
                throw "This def shouldn't happen";

            const draggedOnBoard = isTileLocOnBoard(canvasToTile(mouseLoc)),
                draggedWidth = tileWidth * (draggedOnBoard ? HOVER_WIDTH_RATIO : 1),
                draggedShadowWidth = tileWidth * (draggedOnBoard ? SHADOW_WIDTH_RATIO : 1);

            paintTile(ctx, dragLoc.x, dragLoc.y, draggedWidth, draggedShadowWidth, owner, 255);
        }
    }
}

export const boardRenderer = new BoardRenderer(board, players, dice, audioSystem, imageSystem);


export class TileMoveRenderer {

    private readonly audioSystem: AudioSystem;

    readonly from: Vec2;
    readonly to: Vec2;
    readonly tile: Tile;
    readonly replacingTile: Tile;
    readonly isRosette: boolean;
    onComplete: (from: Vec2, to: Vec2) => void;

    private startTime: number;
    private readonly duration: number;
    private age: number;
    private ttl: number;

    private hitSoundsPlayed: boolean;

    constructor(board: Board, audioSystem: AudioSystem, from: Vec2, to: Vec2) {
        this.audioSystem = audioSystem;

        this.from = from;
        this.to = to;
        this.tile = board.getTile(from);
        this.replacingTile = board.getTile(to);
        this.isRosette = Board.isRosette(to);
        this.onComplete = null;

        const path = Board.getPath(Tile.getPlayerNo(this.tile)),
              moveLength = path.indexOf(to) - path.indexOf(from);

        this.startTime = getTime();
        this.duration = TILE_MOVE_DURATIONS[moveLength];
        this.age = 0;
        this.ttl = this.duration;

        this.hitSoundsPlayed = false;
    }

    skipTileMovement() {
        this.startTime -= this.duration;
    }

    runOnFinish(onComplete: (from: Vec2, to: Vec2) => void) {
        const previousOnComplete = this.onComplete;
        if (previousOnComplete !== null) {
            this.onComplete = function(from: Vec2, to: Vec2) {
                try {
                    onComplete(from, to);
                } finally {
                    previousOnComplete(from, to);
                }
            };
        } else {
            this.onComplete = onComplete;
        }
    }

    /**
     * Returns whether the tile move has finished.
     */
    update(time: number): boolean {
        this.age = (time - this.startTime) / this.duration;
        this.ttl = (this.startTime + this.duration) - time;
        if (this.age < 1)
            return false;

        if (!this.hitSoundsPlayed) {
            this.hitSoundsPlayed = true;
            if (this.replacingTile !== Tile.EMPTY) {
                this.audioSystem.playSound("kill");
            } else {
                this.audioSystem.playSound("place");
            }
        }

        // The rosette land animation is played into negative time...
        return !this.isRosette || this.ttl <= -0.3;
    }
}




function drawMovingTile(ctx, time, tileWidth) {
    // There is no moving tile
    if (!isTileLocValid(tileMove.fromTile))
        return;

    const path = getTilePath(tileMove.owner),
          startIndex = vecListIndexOf(path, tileMove.fromTile),
          endIndex = vecListIndexOf(path, tileMove.toTile),
          curve = computePathCurve(startIndex, endIndex, tileMove.owner);

    const age = min(1, tileMove.age),
          startCurveIndex = min(curve.length - 1, Math.floor(easeInOutSine(age) * curve.length)),
          startLoc = curve[startCurveIndex],
          endLoc = curve[curve.length - 1];

    if (tileMove.replacingOwner !== TILE_EMPTY) {
        paintTile(ctx, endLoc.x, endLoc.y, tileWidth, tileWidth, tileMove.replacingOwner, 0);
    }

    const tileMovingWidth = tileWidth * (1 + 0.2 * 2 * (0.5 - Math.abs(easeInOutSine(age) - 0.5))),
          tileShadowColour = (tileMove.age > 1 ? 255 : 0);

    paintTile(ctx, startLoc.x, startLoc.y, tileMovingWidth, tileMovingWidth, tileMove.owner, tileShadowColour);
}

function getDrawPotentialMoveTile() {
    if (!isAwaitingMove())
        return VEC_NEG1;

    if (isTileSelected(draggedTile))
        return draggedTile;

    if (isTileSelected())
        return selectedTile;

    if (board.getTile(hoveredTile) === ownPlayer.playerNo)
        return hoveredTile;

    return VEC_NEG1;
}

function computePathCurve(startIndex, endIndex, playerNo) {
    playerNo = (playerNo !== undefined ? playerNo : getActivePlayer().playerNo);

    const tilePath = getTilePath(playerNo),
          locPath = [];

    for (let index = startIndex; index <= endIndex; ++index) {
        locPath.push(tileToCanvas(tilePath[index]));
    }

    return createBezierCurveFromPath(locPath);
}

function drawPath(ctx, time, endTile, curve, isValidMove, dragLoc) {
    const tileWidth = getTileWidth();

    ctx.save();
    ctx.beginPath();

    if (isValidMove) {
        ctx.strokeStyle = (isTileHovered(endTile) ? rgb(100, 255, 100) : rgb(255));
    } else {
        ctx.strokeStyle = rgb(255, 70, 70);
    }

    ctx.shadowColor = rgb(0);
    ctx.shadowBlur = tileWidth / 10;
    ctx.lineWidth = tileWidth / 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([tileWidth / 6, tileWidth / 3]);

    const timeMouseDown = mouseDownTime - tilePathAnchorTime;

    // Make the dashes move over time
    let dashOffset = 0.75 * tileWidth * time;
    if(mouseDown) {
        // Make the dashes move more slowly when dragging the tile
        dashOffset += 0.3 * tileWidth * (time - timeMouseDown);
    }
    ctx.lineDashOffset = dashOffset;

    const endLoc = curve[curve.length - 1];
    ctx.moveTo(endLoc.x, endLoc.y);

    if (dragLoc !== null && vecDist(dragLoc, curve[0]) > DRAG_DIRECT_LINE_TILE_WIDTHS * tileWidth) {
        // Just draw a direct line to the end point
        ctx.lineTo(dragLoc.x, dragLoc.y);
    } else {
        // Draw the path curve
        for (let index = curve.length - 2; index >= 0; --index) {
            const point = curve[index];
            ctx.lineTo(point.x, point.y);
        }
    }

    ctx.stroke();
    ctx.closePath();

    // Draw a cross if its not a valid move
    if(!isValidMove && board.getTile(endTile) === TILE_EMPTY) {
        ctx.beginPath();
        ctx.setLineDash([]);

        const crossSize = tileWidth / 6;
        ctx.moveTo(endLoc.x - crossSize, endLoc.y - crossSize);
        ctx.lineTo(endLoc.x + crossSize, endLoc.y + crossSize);
        ctx.moveTo(endLoc.x - crossSize, endLoc.y + crossSize);
        ctx.lineTo(endLoc.x + crossSize, endLoc.y - crossSize);
        ctx.stroke();
    }
    ctx.restore();
}

function getTileImage(tile: Tile, width: number) {
    switch (tile) {
        case Tile.DARK:  return imageSystem.getImageResource("tile_dark", width);
        case Tile.LIGHT: return imageSystem.getImageResource("tile_light", width);
        default:
            return null;
    }
}

function renderTile(
        ctx: CanvasRenderingContext2D,
        location: Vec2, width: number, shadowWidth: number, tile: Tile,
        shadowRed?: number, shadowGreen?: number, shadowBlue?: number) {

    // This makes the start & end tiles smaller.
    if(!Board.isLocOnBoard(location)) {
        width /= HOVER_WIDTH_RATIO;
        shadowWidth /= SHADOW_WIDTH_RATIO;
    }
    paintTile(ctx, tileToCanvas(location), width, shadowWidth, tile, shadowRed, shadowGreen, shadowBlue);
}

function paintTile(
        ctx: CanvasRenderingContext2D, centre: Vec2,
        width: number, shadowWidth: number, tile: Tile,
        shadowRed?: number, shadowGreen?: number, shadowBlue?: number) {

    const left = centre.x - width / 2,
          top = centre.y - width / 2,
          shadowRadius = shadowWidth / 2,
          tileImage = getTileImage(tile, width);

    if(shadowWidth > 0) {
        drawCircularShadow(ctx, centre.x, centre.y, shadowRadius, shadowRed, shadowGreen, shadowBlue);
    }
    ctx.drawImage(tileImage, left, top, width, width);
}
