"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeTravelDebugger = void 0;
/**
 * Holds the execution timeline produced by a single run and a cursor into it.
 * Navigation is pure cursor movement; the data is reloaded each evaluation.
 */
class TimeTravelDebugger {
    constructor() {
        this.steps = [];
        this.currentStepIndex = -1;
    }
    /** Replace the timeline from a fresh run's records. */
    load(records, document) {
        const lineCount = document?.lineCount ?? 0;
        this.steps = records.map((r, i) => ({
            index: i,
            line: r.line,
            lineText: document && r.line >= 1 && r.line <= lineCount
                ? document.lineAt(r.line - 1).text.trim()
                : '',
            kind: r.kind,
            short: r.short,
            full: r.full,
            valueType: r.valueType
        }));
        this.currentStepIndex = this.steps.length - 1;
    }
    clearHistory() {
        this.steps = [];
        this.currentStepIndex = -1;
    }
    canStepBack() { return this.currentStepIndex > 0; }
    canStepForward() { return this.currentStepIndex < this.steps.length - 1; }
    stepBack() {
        if (this.canStepBack()) {
            this.currentStepIndex--;
            return this.getCurrentStep();
        }
        return null;
    }
    stepForward() {
        if (this.canStepForward()) {
            this.currentStepIndex++;
            return this.getCurrentStep();
        }
        return null;
    }
    goToStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.currentStepIndex = index;
            return this.getCurrentStep();
        }
        return null;
    }
    getCurrentStep() {
        return this.steps[this.currentStepIndex] ?? null;
    }
    getAllSteps() { return [...this.steps]; }
    getCurrentStepIndex() { return this.currentStepIndex; }
}
exports.TimeTravelDebugger = TimeTravelDebugger;
//# sourceMappingURL=timeTravel.js.map