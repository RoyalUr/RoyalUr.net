//
// This file contains code to interact with the RoyalUrAnalysis program.
//
// The RoyalUrAnalysis project implements many different sophisticated
// AI's for playing The Royal Game of Ur, and is compiled into WASM.
// This file then loads the WASM program for RoyalUrAnalysis, and
// interacts with it through sending and receiving string requests.
//
// RoyalUrAnalysis: https://github.com/Sothatsit/RoyalUrAnalysis/
//

const royalUrAnalysis = {
    source: "/game/royal_ur_analysis.wasm",
    loaded: false,
    errored: false,

    request: null
};
// Used by RoyalUrAnalysis to fetch the request.
royalUrAnalysis.getRequest = function() {
    return this.request;
}.bind(royalUrAnalysis);

/** Sends a request to the RoyalUrAnalysis program. **/
function sendRoyalUrAnalysisRequest(request) {
    if (!royalUrAnalysis.loaded)
        throw "RoyalUrAnalysis has not been loaded!";

    const bytecoderRequest = bytecoder.toBytecoderString(request);
    royalUrAnalysis.request = bytecoderRequest;

    const bytecoderResponse = bytecoder.exports.handleRequest();
    return bytecoder.toJSString(bytecoderResponse);
}

/** Initialises the RoyalUrAnalysis WASM program. **/
function initRoyalUrAnalysisProgram(result) {
    bytecoder.init(result.instance);

    bytecoder.exports.initMemory(0);
    bytecoder.exports.bootstrap(0);
    bytecoder.initializeFileIO();
    bytecoder.exports.main(0);

    // We have to activate the garbage collector!
    startGarbageCollector();

    royalUrAnalysis.loaded = true;
    console.log("RoyalUrAnalysis has been loaded. Test: " + sendRoyalUrAnalysisRequest("testing123"));
}

/** Disables RoyalUrAnalysis functionality. **/
function onFailToLoadRoyalUrAnalysis(error) {
    console.error("Failed to load RoyalUrAnalysis: " + error);
    royalUrAnalysis.errored = true;
}

/** Periodically runs the garbage collector for RoyalUrAnalysis. **/
function startGarbageCollector() {
    const gcInterval = 200,
          gcMaxObjectsPerRun = 30;

    let gcRunning = false;
    setInterval(function() {
        if (!gcRunning) {
            gcRunning = true;
            bytecoder.exports.IncrementalGC(0, gcMaxObjectsPerRun);
            gcRunning = false;
        }
    }, gcInterval);
}

// Try to load the WASM file of RoyalUrAnalysis.
bytecoder.imports.royalUrAnalysis = royalUrAnalysis;
WebAssembly.instantiateStreaming(fetch(royalUrAnalysis.source), bytecoder.imports)
    .then(initRoyalUrAnalysisProgram)
    .catch(function(error) {
        console.log("Using fallback method to load WebAssembly! "
            + "Check if mime types for WebAssembly are configured correctly!\n"
            + error);

        const request = new XMLHttpRequest();
        request.open('GET', royalUrAnalysis.source);
        request.responseType = 'arraybuffer';
        request.send();

        request.onload = function() {
            WebAssembly.instantiate(request.response, bytecoder.imports)
                .then(initRoyalUrAnalysisProgram);
        };
    });
