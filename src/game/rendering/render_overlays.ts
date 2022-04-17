//
// This file contains code to render the overlays that are shown over the top of the game.
// This includes the full-screen messages, and also the fireworks on the win screen.
//


const SOCIALS_TRANSITION_DURATION = 10,
      SOCIALS_FADE_DURATION = 0.5,
      SOCIALS_FADE_RATIO = SOCIALS_FADE_DURATION / SOCIALS_TRANSITION_DURATION;

let socialsFadeAnchorTime = LONG_TIME_AGO;

function redrawMessage() {
    const messageFade = message.fade.get();
    messageTitleElement.textContent = message.title;
    messageSubtitleElement.textContent = message.subtitle;
    setElemStyle(messageSubtitleElement, "display", (message.subtitle.length === 0 ? "none" : ""));
    setElemOpacity(messageContainerElement, messageFade);

    // When messages cannot be dismissed, they should not block access to the controls.
    if (messageFade === 0 || message.dismissable) {
        messageContainerElement.classList.remove("below-controls");
    } else {
        messageContainerElement.classList.add("below-controls");
    }

    const socialsOpacity = max(0, 2.5 * screenState.socialsFade.get() - 1.5);
    if (socialsOpacity <= 0) {
        setElemOpacity(joinDiscordElement, 0);
        setElemOpacity(starGithubElement, 0);
        return;
    }

    const timeSinceSwitch = getTime() - socialsFadeAnchorTime,
        transitionValue = (timeSinceSwitch % (2 * SOCIALS_TRANSITION_DURATION)) / SOCIALS_TRANSITION_DURATION,
        ratio = SOCIALS_FADE_RATIO,
        value = transitionValue % 1,
        opacity = socialsOpacity * (value < ratio ? value : (1 - value < ratio ? 1 - value : ratio)) / ratio;

    if (transitionValue < 1) {
        setElemOpacity(joinDiscordElement, opacity);
        setElemOpacity(starGithubElement, 0);
    } else {
        setElemOpacity(joinDiscordElement, 0);
        setElemOpacity(starGithubElement, opacity);
    }
}



//
// Rendering of the fireworks overlay.
//

function redrawOverlay() {
    // If we don't have to draw to the canvas, just don't display it at all
    const overlayIsEmpty = (fireworks.length === 0 && particles.birthTime.length === 0);
    setElemStyle(overlayCanvas, "display", overlayIsEmpty ? "none" : "");

    overlayCtx.clearRect(0, 0, overlayWidth, overlayHeight);

    simulateFireworks();
    removeDeadParticles();
    drawParticles(overlayCtx);
}

const MIN_WIN_FIREWORK_PERIOD = 2.0,
      MAX_WIN_FIREWORK_PERIOD = 4.0,
      WIN_FIREWORK_REGIONS = [
          {"min_x": 0.15, "max_x": 0.35, "min_y": 0.15, "max_y": 0.5},
          {"min_x": 0.65, "max_x": 0.85, "min_y": 0.15, "max_y": 0.5}
      ],
      WIN_FIREWORK_SPEED = 300 / 1280;

const nextFireworkTimes = []; {
    for (let index = 0; index < WIN_FIREWORK_REGIONS.length; ++index) {
        nextFireworkTimes.push(0);
    }
}

function spawnWinFireworks() {
    for (let index = 0; index < WIN_FIREWORK_REGIONS.length; ++index) {
        const timeToFirework = nextFireworkTimes[index] - getTime();

        if (timeToFirework > 0)
            continue;

        const timeToNext = rand(MIN_WIN_FIREWORK_PERIOD, MAX_WIN_FIREWORK_PERIOD);
        nextFireworkTimes[index] = getTime() + timeToNext;

        const region = WIN_FIREWORK_REGIONS[index],
            x1 = overlayWidth * rand(region.min_x, region.max_x),
            y1 = overlayHeight,
            x2 = overlayWidth * rand(region.min_x, region.max_x),
            y2 = overlayHeight * rand(region.min_y, region.max_y);

        // We want to cut out hues from 0.61 to 0.78 as they are too dark
        let hue = rand(1 - (0.78 - 0.61));
        hue = (hue <= 0.61 ? hue : hue + (0.78 - 0.61));
        const colour = convertHSVtoRGB(hue, 1, 1);

        createFirework(x1, y1, x2, y2, WIN_FIREWORK_SPEED * height, colour.r, colour.g, colour.b);
    }
}
