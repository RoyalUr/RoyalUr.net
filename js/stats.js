//
// This file is used to record statistics about the performance of rendering.
//

const STAT_OVERALL = "overall",
      STAT_BOARD = "board",
      STAT_LOADING = "loading",
      STAT_MENU = "menu",
      STAT_TILES = "tiles",
      STAT_DICE = "dice",
      STAT_SCORES = "scores",
      STAT_NETWORK_STATUS = "network_status",
      STAT_MESSAGE = "message",
      STAT_WIN_SCREEN = "win_screen",
      STAT_OVERLAY = "overlay";

const renderStatCounters = {
    start: getTime(),
    stats: {}
};

let lastRenderStatsSummary = {},
    fps = 0;

function getRenderStatistic(statistic) {
    const summary = lastRenderStatsSummary[statistic];
    if (summary !== undefined)
        return summary;

    return {
        totalCalls: 0,
        cumulativeTime: 0,

        callsPerSecond: 0,
        averageTime: 0,
        percentTime: 0
    };
}

function registerRenderCallStats(statistic, duration) {
    let counter = renderStatCounters.stats[statistic];
    if (counter === undefined) {
        counter = {
            calls: 0,
            cumulativeTime: 0
        };
        renderStatCounters.stats[statistic] = counter;
    }

    counter.calls += 1;
    counter.cumulativeTime += duration;
}

function recordRenderCallStatistics(statistic, func) {
    const start = getTime();

    { // Call the function
        func();
    }

    const end = getTime();

    registerRenderCallStats(statistic, end - start);
}

function updateRenderStatistics() {
    const time = getTime(),
        duration = time - renderStatCounters.start,
        summary = {};

    renderStatCounters.start = time;

    for (let key in renderStatCounters.stats) {
        if (!renderStatCounters.stats.hasOwnProperty(key))
            continue;

        const statsEntry = renderStatCounters.stats[key];

        summary[key] = {
            totalCalls: statsEntry.calls,
            cumulativeTime: statsEntry.cumulativeTime,

            callsPerSecond: statsEntry.calls / duration,
            averageTime: statsEntry.cumulativeTime / statsEntry.calls,
            percentTime: statsEntry.cumulativeTime / duration
        };
    }

    // Reset all stat counters
    renderStatCounters.stats = {};

    lastRenderStatsSummary = summary;
    fps = getRenderStatistic(STAT_OVERALL).callsPerSecond;
}

function reportRenderStatistics() {
    let summaries = [];
    for (let key in lastRenderStatsSummary) {
        if (!lastRenderStatsSummary.hasOwnProperty(key))
            continue;
        summaries.push({
            statistic: key,
            summary: lastRenderStatsSummary[key]
        });
    }

    if (summaries.length === 0) {
        console.log("No statistics recorded");
        return;
    }

    summaries.sort((a, b) => {
        const x = a.summary.percentTime,
            y = b.summary.percentTime;
        return (x < y) ? 1 : ((x > y) ? -1 : 0);
    });

    const roundedFPS = Math.round(fps);

    let report = "Render Statistics (" + roundedFPS + " fps):\n";
    for (let index = 0; index < summaries.length; ++index) {
        const entry = summaries[index],
            statistic = entry.statistic,
            summary = entry.summary;

        report += "  " + Math.round(summary.percentTime * 1000) / 10 + "% : " + statistic;
        report += " - " + Math.round(summary.averageTime * 1000 * 100) / 100 + "ms per call";

        if (roundedFPS !== Math.round(summary.callsPerSecond)) {
            report += ", " + Math.round(summary.callsPerSecond) + " calls per second";
        }

        report += "\n";
    }

    console.log(report);
}