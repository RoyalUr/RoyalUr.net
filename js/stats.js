//
// This file is used to record statistics about the performance of rendering.
//

const STATS_OVERALL = "overall",
      STATS_BOARD = "board",
      STATS_LOADING = "loading",
      STATS_MENU = "menu",
      STATS_TILES = "tiles",
      STATS_DICE = "dice",
      STATS_SCORES = "scores",
      STATS_NETWORK_STATUS = "network_status",
      STATS_MESSAGE = "message",
      STATS_WIN_SCREEN = "win_screen",
      STATS_OVERLAY = "overlay";

const statCounters = {
    start: getTime(),
    stats: {}
};

let lastStatsSummary = {},
    fps = 0;

function getStatistic(statistic) {
    const summary = lastStatsSummary[statistic];
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

function registerCallStats(statistic, duration) {
    let counter = statCounters.stats[statistic];
    if (counter === undefined) {
        counter = {
            calls: 0,
            cumulativeTime: 0
        };
        statCounters.stats[statistic] = counter;
    }

    counter.calls += 1;
    counter.cumulativeTime += duration;
}

function recordCallStatistics(statistic, func) {
    const start = getTime();

    { // Call the function
        func();
    }

    const end = getTime();

    registerCallStats(statistic, end - start);
}

function updateStatistics() {
    const time = getTime(),
        duration = time - statCounters.start,
        summary = {};

    statCounters.start = time;

    for (let key in statCounters.stats) {
        if (!statCounters.stats.hasOwnProperty(key))
            continue;

        const statsEntry = statCounters.stats[key];

        summary[key] = {
            totalCalls: statsEntry.calls,
            cumulativeTime: statsEntry.cumulativeTime,

            callsPerSecond: statsEntry.calls / duration,
            averageTime: statsEntry.cumulativeTime / statsEntry.calls,
            percentTime: statsEntry.cumulativeTime / duration
        };
    }

    // Reset all stat counters
    statCounters.stats = {};

    lastStatsSummary = summary;
    fps = getStatistic(STATS_OVERALL).callsPerSecond;
}

function reportStatistics() {
    let summaries = [];
    for (let key in lastStatsSummary) {
        if (!lastStatsSummary.hasOwnProperty(key))
            continue;
        summaries.push({
            statistic: key,
            summary: lastStatsSummary[key]
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

    let report = "Statistics:\n";
    for (let index = 0; index < summaries.length; ++index) {
        const entry = summaries[index],
            statistic = entry.statistic,
            summary = entry.summary;

        report += "  " + Math.round(summary.percentTime * 1000) / 10 + "% : " + statistic;
        report += " - " + Math.round(summary.averageTime * 1000 * 100) / 100 + "ms per call";
        report += ", " + Math.round(summary.callsPerSecond) + " calls per second";
        report += "\n";
    }

    console.log(report);
}