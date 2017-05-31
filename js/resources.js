//
// AUDIO
//

const audioResources = [
    // Sounds
    {
        key: "place_1",
        url: "res/audio/place_1.mp3",
        song: false
    }, {
        key: "place_2",
        url: "res/audio/place_2.mp3",
        song: false
    }, {
        key: "place_3",
        url: "res/audio/place_3.mp3",
        song: false
    }, {
        key: "place_4",
        url: "res/audio/place_4.mp3",
        song: false
    },

    {
        key: "pickup_1",
        url: "res/audio/pickup_1.mp3",
        song: false
    }, {
        key: "pickup_2",
        url: "res/audio/pickup_2.mp3",
        song: false
    }, {
        key: "pickup_3",
        url: "res/audio/pickup_3.mp3",
        song: false
    }
];

const audioPacks = {
    "place": ["place_1", "place_2", "place_3", "place_4"],
    "pickup": ["pickup_1", "pickup_2", "pickup_3"]
};

const audioPreferences = {
    songsMuted: false,
    songsVolume: 0.5,

    soundMuted: false,
    soundVolume: 0.5
};

function setSongsMuted(songsMuted) {
    audioPreferences.songsMuted = songsMuted;
    updateAudioVolumes();
}

function setSongsVolume(songsVolume) {
    audioPreferences.songsVolume = songsVolume;
    updateAudioVolumes();
}

function setSoundMuted(soundMuted) {
    audioPreferences.soundMuted = soundMuted;
    updateAudioVolumes();
}

function setSoundVolume(soundVolume) {
    audioPreferences.soundVolume = soundVolume;
    updateAudioVolumes();
}

function updateAudioVolumes() {
    const songVolume = (!audioPreferences.songsMuted ? audioPreferences.songsVolume : 0),
          soundVolume = (!audioPreferences.soundMuted ? audioPreferences.soundVolume : 0);

    for(let index = 0; index < audioResources.length; ++index) {
        const resource = audioResources[index];

        if(!resource.element)
            continue;

        resource.element.volume = (resource.song ? songVolume : soundVolume);
    }
}

function playSound(key, onComplete) {
    if(audioPacks[key]) {
        const pack = audioPacks[key];

        key = pack[randInt(pack.length)];
    }

    for(let index = 0; index < audioResources.length; ++index) {
        const resource = audioResources[index];

        if(resource.key !== key)
            continue;

        resource.element.onended = onComplete;
        resource.element.play();
        return;
    }

    error("Unable to find the sound \"" + key + "\"");
}

const songQueue = [];

let lastSong = undefined;

function playSong() {
    if(songQueue.length === 0) {
        for(let index = 0; index < audioResources.length; ++index) {
            const resource = audioResources[index];

            if(!resource.song || lastSong === resource)
                continue;

            songQueue.push(resource);
        }

        if(songQueue.length === 0) {
            setTimeout(playSong, 15);
            return;
        }
    }

    const playIndex = randInt(songQueue.length),
          resource = songQueue[playIndex];

    songQueue.splice(playIndex, 1);

    resource.element.onended = playSong;
    resource.element.play();

    lastSong = resource;
}

function loadAudio(onComplete) {
    const countdown = {
        count: audioResources.length
    };

    for(let index = 0; index < audioResources.length; ++index) {
        const resource = audioResources[index],
              element = document.createElement("audio");

        resource.element = element;

        element.preload = "auto";
        element.onloadeddata = function() {
            countdown.count -= 1;

            if(countdown.count === 0) {
                onComplete();
            }
        };
        element.src = resource.url;
    }
}



//
// IMAGES
//

const imageURLS = {
    "board": "res/board.png",
    "darkTile": "res/darkTile.png",
    "lightTile": "res/lightTile.png",
    "diceUp1": "res/diceUp1.png",
    "diceUp2": "res/diceUp2.png",
    "diceUp3": "res/diceUp3.png",
    "diceDown1": "res/diceDown1.png",
    "diceDown2": "res/diceDown2.png",
    "diceDown3": "res/diceDown3.png",
    "diceDarkShadow": "res/diceDarkShadow.png",
    "diceLightShadow": "res/diceLightShadow.png"
};

const imageResources = {};

function loadImages(onComplete) {
    const countdown = {
        count: 0
    };

    for(let key in imageURLS) {
        if(!imageURLS.hasOwnProperty(key))
            continue;

        countdown.count += 1;

        const imageResource = {
            key: key,
            image: new Image(),
            width: NaN,
            height: NaN,
            scaled: []
        };
        imageResource.scaled.push(imageResource.image);

        imageResource.image.onload = function() {
            countdown.count -= 1;

            imageResource.width = this.width;
            imageResource.height = this.height;

            if(!imageResource.width || !imageResource.height) {
                error("[FATAL] Failed to load image resource \"" + imageResource.key + "\", invalid width or height"
                      + " (" + imageResource.width + " x " + imageResource.height + ")");

                imageResources[imageResource.key] = undefined;
                return;
            }

            setTimeout(function() {
                createScaledImageVersions(imageResource);

                if(countdown.count === 0) {
                    onComplete();
                }
            }, 0);
        };

        imageResource.image.src = imageURLS[key];
        imageResources[key] = imageResource;
    }

}

function createScaledImageVersions(imageResource) {
    // Create 6 initial down-scaled versions of the image resource
    getImageResource(imageResource.key, imageResource.width / Math.pow(2, 6));
}

function getImageResource(key, width) {
    const imageResource = imageResources[key];

    if(!imageResource) {
        error("Cannot find image with key \"" + key + "\"");
        return null;
    }

    const scaledowns = Math.floor(Math.log(imageResource.width / width) / Math.log(2)) - 1;

    if(!width || scaledowns <= 0)
        return imageResource.image;

    if(scaledowns >= imageResource.scaled.length) {
        let scaledownsDone = imageResource.scaled.length - 1,
            current = imageResource.scaled[scaledownsDone];

        while(scaledownsDone < scaledowns) {
            scaledownsDone += 1;

            const next = renderResource(current.width / 2, current.height / 2, function(ctx, canvas) {
                ctx.drawImage(current, 0, 0, canvas.width, canvas.height);
            });

            imageResource.scaled[scaledownsDone] = next;
            current = next;
        }
    }

    return imageResource.scaled[scaledowns];
}

function getImageResourceFromHeight(key, height) {
    const imageResource = imageResources[key];

    if(!imageResource) {
        error("Cannot find image with key \"" + key + "\"");
        return null;
    }

    const scale = height / imageResource.height,
          width = scale * imageResource.width;

    return getImageResource(key, width);
}

function renderResource(width, height, renderFunction) {
    const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    renderFunction(ctx, canvas);

    return canvas;
}

function calcImageWidth(image, height) {
    return image.width / image.height * height;
}

function calcImageHeight(image, width) {
    return image.height / image.width * width;
}
