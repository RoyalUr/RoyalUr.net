//
// This file contains code for the dice page.
// This code allows people to roll the dice on this page.
//

import {getTime, setElemStyle} from "@/common/utils"
import {ArticleResourceLoader} from "@/articles/base/article_resources";
import {ImageResource, AudioResource} from "@/common/resources/resource_types";
import {AudioSystem} from "@/common/resources/audio_system";
import {ImageSystem} from "@/common/resources/image_system";
import {
    dice,
    generateRandomDiceValues,
    setDiceValues,
    setWaitingForDiceRoll,
    startRollingDice
} from "@/game/model/dice_model";


const resourceLoader = new ArticleResourceLoader([[
    new ImageResource("dice_up1", "/res/dice_up1.[ver]"),
    new ImageResource("dice_up2", "/res/dice_up2.[ver]"),
    new ImageResource("dice_up3", "/res/dice_up3.[ver]"),
    new ImageResource("dice_down1", "/res/dice_down1.[ver]"),
    new ImageResource("dice_down2", "/res/dice_down2.[ver]"),
    new ImageResource("dice_down3", "/res/dice_down3.[ver]"),
    new ImageResource("dice_down1", "/res/dice_down1.[ver]"),
    new ImageResource("dice_dark_shadow", "/res/dice_dark_shadow.[ver]"),
    new ImageResource("dice_light_shadow", "/res/dice_light_shadow.[ver]"),
    new AudioResource("dice_click", "/res/audio_dice_click.[ver].mp4", {instances: 5, volume: 0.5}),
    new AudioResource("dice_hit", "/res/audio_dice_hit.[ver].mp4", {instances: 4, volume: 0.3}),
    new AudioResource("dice_select", "/res/audio_dice_select.[ver].mp4", {instances: 4, volume: 0.5}),
]]);
const audioSystem = new AudioSystem(resourceLoader, {}),
      imageSystem = new ImageSystem(resourceLoader);

resourceLoader.startLoading();
imageSystem.populateDynamicImages();
imageSystem.loadDynamicButtons();


const diceCanvas = document.getElementById("dice") as HTMLCanvasElement,
      diceCtx = diceCanvas.getContext("2d"),
      dicePrompt = document.getElementById("dice-prompt");

let diceWidth = NaN,
    diceHeight = NaN;

function setup() {
    diceCanvas.style.display = "";

    calculateDiceSize();
    setDiceValues(generateRandomDiceValues());
    setWaitingForDiceRoll(true);

    diceCanvas.addEventListener("click", rollDice);
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });

    requestAnimationFrame(redrawProbability);
}

function isDiceLoaded() {
    return resourceLoader.loadingStage >= 1;
}

function calculateDiceSize() {
    const diceBounds = diceCanvas.getBoundingClientRect(),
          newDiceWidth = Math.ceil(diceBounds.width * window.devicePixelRatio),
          newDiceHeight = Math.ceil(diceBounds.height * window.devicePixelRatio);

    if (diceWidth !== newDiceWidth || diceHeight !== newDiceHeight) {
        diceWidth = newDiceWidth;
        diceHeight = newDiceHeight;
        diceCanvas.width = diceWidth;
        diceCanvas.height = diceHeight;
    }
}

function rollDice() {
    if (!isDiceLoaded() || !dice.canBeRolled)
        return;
    dice.callback = () => {
        setTimeout(() => {
            setWaitingForDiceRoll(true);
        }, 500);
    };
    startRollingDice();
    setDiceValues(generateRandomDiceValues());
}

/** In the game the dice will be hidden sometimes, but not here. **/
const GAME_VISIBLE_SCREENS = [];
function isOnScreen() {
    return true;
}

function redrawProbability() {
    // We have to load the dice images before we can draw the dice.
    const loaded = isDiceLoaded();
    setElemStyle(dicePrompt, "display", loaded ? "" : "none");
    if (loaded) {
        calculateDiceSize();
        redrawDice();
    } else {
        diceCtx.clearRect(0, 0, diceWidth, diceHeight);

        const angleOffset = (1.5 * Math.PI * getTime()) % (2 * Math.PI),
              centreX = diceWidth / 2,
              centreY = diceHeight / 2,
              radius = diceHeight / 4,
              dx = radius * Math.cos(angleOffset),
              dy = radius * Math.sin(angleOffset),
              gradient = diceCtx.createLinearGradient(centreX + dx, centreY + dy, centreX - dx, centreY - dy);

        gradient.addColorStop(0.05, "rgba(255, 255, 255, 0)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 1)");

        diceCtx.strokeStyle = gradient;
        diceCtx.lineWidth = diceHeight / 30;
        diceCtx.beginPath();
        diceCtx.arc(diceWidth / 2, diceHeight / 2, 50, angleOffset, angleOffset + Math.PI * 6 / 4);
        diceCtx.stroke();
    }
    requestAnimationFrame(redrawProbability);
}

setup();
