//
// This file is used to record statistics about the performance of the page.
// These statistics are not shared with the server, and are only used for local debugging.
//

import {getTime} from "@/common/utils";

export enum RenderStat {
    OVERALL = "overall",
    BOARD = "board",
    LOADING = "loading",
    MENU = "menu",
    TILES = "tiles",
    DICE = "dice",
    SCORES = "scores",
    NETWORK_STATUS = "network_status",
    WAIT_FRIEND = "waiting_for_friend",
    MESSAGE = "message",
    WIN_SCREEN = "win_screen",
    OVERLAY = "overlay"
}

export class RenderStatSummary {

    readonly totalCalls: number;
    readonly cumulativeTime: number;
    readonly callsPerSecond: number;
    readonly averageTime: number;
    readonly percentTime: number;

    constructor(
        totalCalls: number, cumulativeTime: number,
        callsPerSecond: number, averageTime: number,
        percentTime: number) {

        this.totalCalls = totalCalls;
        this.cumulativeTime = cumulativeTime;
        this.callsPerSecond = callsPerSecond;
        this.averageTime = averageTime;
        this.percentTime = percentTime;
    }

    static createZeroed(): RenderStatSummary {
        return new RenderStatSummary(0, 0, 0, 0, 0);
    }
}

class RenderStatCounter {

    start: number;
    count: number;
    cumulativeTime: number;

    constructor() {
        this.reset();
    }

    reset(): RenderStatSummary {
        const duration = getTime() - this.start;
        this.start = getTime();
        this.count = 0;
        this.cumulativeTime = 0;

        return new RenderStatSummary(
            this.count,
            this.cumulativeTime,
            this.count / duration,
            this.cumulativeTime / this.count,
            this.cumulativeTime / duration
        );
    }

    registerCall(duration: number) {
        this.count += 1;
        this.cumulativeTime += duration;
    }
}


const counters: {[stat in RenderStat]?: RenderStatCounter} = {};
let lastSummaries: {[stat in RenderStat]?: RenderStatSummary} = {},
    fps = 0;

export function getRenderStatistic(statistic: RenderStat): RenderStatSummary {
    const summary = lastSummaries[statistic];
    if (summary !== undefined)
        return summary;

    return RenderStatSummary.createZeroed();
}

export function registerRenderCallStats(statistic: RenderStat, duration: number) {
    let counter = counters[statistic];
    if (counter === undefined) {
        counter = new RenderStatCounter();
        counters[statistic] = counter;
    }
    counter.registerCall(duration);
}

export function recordRenderCallStatistics(statistic: RenderStat, func: () => void) {
    const start = getTime();
    func();
    const end = getTime();

    registerRenderCallStats(statistic, end - start);
}

export function updateRenderStatistics() {
    const summaries: {[stat in RenderStat]?: RenderStatSummary} = {};

    for (let key in counters) {
        if (!counters.hasOwnProperty(key))
            continue;

        summaries[key] = counters[key].reset();
    }

    lastSummaries = summaries;
    fps = getRenderStatistic(RenderStat.OVERALL).callsPerSecond;
}

export function reportRenderStatistics() {
    let summaries = [];
    for (let key in lastSummaries) {
        if (!lastSummaries.hasOwnProperty(key))
            continue;

        summaries.push({
            statistic: key,
            summary: lastSummaries[key]
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