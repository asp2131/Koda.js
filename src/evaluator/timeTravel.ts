import * as vscode from 'vscode';
import { CaptureRecord } from './liveRunner';

/**
 * One step in the execution timeline. Built directly from a CaptureRecord
 * emitted by the LiveRunner (records arrive in execution order), so stepping
 * forward/back walks the program exactly as it ran — including each loop
 * iteration as its own step.
 */
export interface ExecutionStep {
    index: number;
    line: number;        // 1-based source line
    lineText: string;    // trimmed source of that line, for context in the panel
    kind: 'value' | 'log' | 'error';
    short: string;       // inline-style value
    full: string;        // expanded value (hover / tree)
    valueType: string;
}

/**
 * Holds the execution timeline produced by a single run and a cursor into it.
 * Navigation is pure cursor movement; the data is reloaded each evaluation.
 */
export class TimeTravelDebugger {
    private steps: ExecutionStep[] = [];
    private currentStepIndex: number = -1;

    /** Replace the timeline from a fresh run's records. */
    load(records: CaptureRecord[], document?: vscode.TextDocument): void {
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

    clearHistory(): void {
        this.steps = [];
        this.currentStepIndex = -1;
    }

    canStepBack(): boolean { return this.currentStepIndex > 0; }
    canStepForward(): boolean { return this.currentStepIndex < this.steps.length - 1; }

    stepBack(): ExecutionStep | null {
        if (this.canStepBack()) { this.currentStepIndex--; return this.getCurrentStep(); }
        return null;
    }

    stepForward(): ExecutionStep | null {
        if (this.canStepForward()) { this.currentStepIndex++; return this.getCurrentStep(); }
        return null;
    }

    goToStep(index: number): ExecutionStep | null {
        if (index >= 0 && index < this.steps.length) {
            this.currentStepIndex = index;
            return this.getCurrentStep();
        }
        return null;
    }

    getCurrentStep(): ExecutionStep | null {
        return this.steps[this.currentStepIndex] ?? null;
    }

    getAllSteps(): ExecutionStep[] { return [...this.steps]; }
    getCurrentStepIndex(): number { return this.currentStepIndex; }
}
