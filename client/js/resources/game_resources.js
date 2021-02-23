//
// This file contains a list of all of the resources that need to be loaded for the game.
//

const audioPacks = {
    "place": ["place_1", "place_2", "place_3", "place_4"],
    "pickup": ["pickup_1", "pickup_2", "pickup_3"]
};

const annotationsResource = new AnnotationsResource("annotations", "/res/annotations.[ver].json");
const stagedResources = [
    [ // Menu
        new PreloadImageResource("logo", "/res/logo.svg"),
        new PreloadImageResource("play_local", "/res/play_local.svg"),
        new PreloadImageResource("play_computer", "/res/play_computer.svg"),
        new PreloadImageResource("play_online", "/res/play_online.svg"),
        new PreloadImageResource("play_friend", "/res/play_friend.svg"),
        new PreloadImageResource("join_the_discord", "/res/join_the_discord.svg"),
        new PreloadImageResource("star_on_github", "/res/star_on_github.svg"),
        new PreloadImageResource("control_discord", "/res/control_discord.svg"),
        new PreloadImageResource("control_exit", "/res/control_exit.svg"),
        new PreloadImageResource("control_github", "/res/control_github.svg"),
        new PreloadImageResource("control_learn", "/res/control_learn.svg"),
        new PreloadImageResource("control_settings", "/res/control_settings.svg"),
        new ImageResource("play", "/res/button_play.[ver]",  764, 335)
    ],
    [ // Game
        annotationsResource,
        new ImageResource("board", "/res/board.[ver]"),
        new ImageResource("tile_light", "/res/tile_light.[ver]"),
        new ImageResource("tile_dark", "/res/tile_dark.[ver]"),
        new ImageResource("dice_up1", "/res/dice_up1.[ver]"),
        new ImageResource("dice_up2", "/res/dice_up2.[ver]"),
        new ImageResource("dice_up3", "/res/dice_up3.[ver]"),
        new ImageResource("dice_down1", "/res/dice_down1.[ver]"),
        new ImageResource("dice_down2", "/res/dice_down2.[ver]"),
        new ImageResource("dice_down3", "/res/dice_down3.[ver]"),
        new ImageResource("dice_down1", "/res/dice_down1.[ver]"),
        new ImageResource("dice_dark_shadow", "/res/dice_dark_shadow.[ver]"),
        new ImageResource("dice_light_shadow", "/res/dice_light_shadow.[ver]"),
        new AudioResource("game_found", "/res/game_found.[ver].mp4", {volume: 0.3}),
        new AudioResource("place_1", "/res/audio_place_1.[ver].mp4"),
        new AudioResource("place_2", "/res/audio_place_2.[ver].mp4"),
        new AudioResource("place_3", "/res/audio_place_3.[ver].mp4"),
        new AudioResource("place_4", "/res/audio_place_4.[ver].mp4"),
        new AudioResource("pickup_1", "/res/audio_pickup_1.[ver].mp4"),
        new AudioResource("pickup_2", "/res/audio_pickup_2.[ver].mp4"),
        new AudioResource("pickup_3", "/res/audio_pickup_3.[ver].mp4"),
        new AudioResource("error", "/res/audio_error.[ver].mp4", {instances: 3, volume: 0.5}),
        new AudioResource("kill", "/res/audio_kill.[ver].mp4", {volume: 0.5}),
        new AudioResource("hover", "/res/audio_hover.[ver].mp4", {instances: 3, volume: 0.5}),
        new AudioResource("dice_click", "/res/audio_dice_click.[ver].mp4", {instances: 5, volume: 0.5}),
        new AudioResource("dice_hit", "/res/audio_dice_hit.[ver].mp4", {instances: 4, volume: 0.3}),
        new AudioResource("dice_select", "/res/audio_dice_select.[ver].mp4", {instances: 4, volume: 0.5}),
        new AudioResource("firework_rocket", "/res/audio_firework_rocket.[ver].mp4", {instances: 4, volume: 0.03}),
        new AudioResource("firework_explode", "/res/audio_firework_explode.[ver].mp4", {instances: 4, volume: 0.3}),
    ]
];
function getStageLoadingMessage(stage) {
    if (stage >= 1)
        return "Fetching Game Assets...";
    return "The Royal Ur is Loading...";
}



//
// Start the loading!
//

const resourceLoader = new ResourceLoader(stagedResources),
      audioSystem = new AudioSystem(resourceLoader, audioPacks),
      imageSystem = new ImageSystem(resourceLoader);

resourceLoader.startLoading();
