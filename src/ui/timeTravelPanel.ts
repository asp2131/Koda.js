import * as vscode from 'vscode';
import { TimeTravelDebugger, ExecutionStep } from '../evaluator/timeTravel';

export class TimeTravelPanel {
    public static currentPanel: TimeTravelPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private timeTravelDebugger: TimeTravelDebugger;

    // Highlights the source line of the current step in the editor.
    private readonly _lineHighlight = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(120, 170, 255, 0.12)',
        border: '1px solid',
        borderColor: new vscode.ThemeColor('focusBorder'),
        overviewRulerColor: new vscode.ThemeColor('focusBorder'),
        overviewRulerLane: vscode.OverviewRulerLane.Full,
    });

    public static createOrShow(extensionUri: vscode.Uri, timeTravelDebugger: TimeTravelDebugger) {
        const column = vscode.ViewColumn.Two;

        if (TimeTravelPanel.currentPanel) {
            TimeTravelPanel.currentPanel._panel.reveal(column);
            TimeTravelPanel.currentPanel.timeTravelDebugger = timeTravelDebugger;
            TimeTravelPanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'timeTravelDebugger',
            'Koda Debugger',
            column,
            { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] }
        );

        TimeTravelPanel.currentPanel = new TimeTravelPanel(panel, extensionUri, timeTravelDebugger);
    }

    private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri, timeTravelDebugger: TimeTravelDebugger) {
        this._panel = panel;
        this.timeTravelDebugger = timeTravelDebugger;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                const ttd = this.timeTravelDebugger;
                switch (message.command) {
                    case 'stepBack': this._navigate(ttd.stepBack()); return;
                    case 'stepForward': this._navigate(ttd.stepForward()); return;
                    case 'firstStep': this._navigate(ttd.goToStep(0)); return;
                    case 'lastStep': this._navigate(ttd.goToStep(ttd.getAllSteps().length - 1)); return;
                    case 'goToStep': this._navigate(ttd.goToStep(message.index)); return;
                    case 'goToLine':
                        if (typeof message.line === 'number') {
                            this._highlightLine(message.line, true, ttd.getCurrentStep()?.documentUri);
                        }
                        return;
                    case 'clearHistory':
                        ttd.clearHistory();
                        this._clearHighlight();
                        this._update();
                        return;
                    case 'copy':
                        if (typeof message.text === 'string') {
                            vscode.env.clipboard.writeText(message.text);
                            vscode.window.showInformationMessage('Value copied to clipboard!');
                        }
                        return;
                    case 'toggleTimeTravel':
                        vscode.commands.executeCommand('jsEvaluator.toggleTimeTravel');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /** Step navigation from the webview: refresh + highlight (and reveal) the line. */
    private _navigate(step: ExecutionStep | null) {
        this._update();
        if (step) {
            this._highlightStep(step, true);
        }
    }

    /**
     * The editor to decorate. When a webview button is clicked the panel takes
     * focus, so `activeTextEditor` is undefined — fall back to the first visible
     * JS/TS editor.
     */
    private _targetEditor(documentUri?: string): vscode.TextEditor | undefined {
        const isCode = (e: vscode.TextEditor) =>
            e.document.languageId === 'javascript' || e.document.languageId === 'typescript';
        return vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === documentUri)
            ?? (vscode.window.activeTextEditor && isCode(vscode.window.activeTextEditor)
                ? vscode.window.activeTextEditor
                : vscode.window.visibleTextEditors.find(isCode));
    }

    private _highlightStep(step: ExecutionStep, reveal: boolean) {
        this._highlightLine(step.line, reveal, step.documentUri);
    }

    private _highlightLine(line: number, reveal: boolean, documentUri?: string) {
        const editor = this._targetEditor(documentUri);
        if (!editor || line < 1 || line > editor.document.lineCount) {
            return;
        }
        const lineIdx = line - 1;
        const range = new vscode.Range(lineIdx, 0, lineIdx, editor.document.lineAt(lineIdx).text.length);
        editor.setDecorations(this._lineHighlight, [range]);
        if (reveal) {
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }

    private _clearHighlight() {
        this._targetEditor(this.timeTravelDebugger.getCurrentStep()?.documentUri)?.setDecorations(this._lineHighlight, []);
    }

    public update() {
        this._update();
        // Keep the current line highlighted as the timeline reloads, but don't
        // yank the editor viewport on every keystroke.
        const current = this.timeTravelDebugger.getCurrentStep();
        if (current) {
            this._highlightStep(current, false);
        } else {
            this._clearHighlight();
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _kindColor(kind: ExecutionStep['kind']): string {
        switch (kind) {
            case 'step': return '#61AFEF';  // blue
            case 'log': return '#D19A66';   // orange
            case 'error': return '#E06C75'; // red
            default: return '#98C379';      // green (value)
        }
    }

    private _getHtmlForWebview(): string {
        const steps = this.timeTravelDebugger.getAllSteps();
        const currentIndex = this.timeTravelDebugger.getCurrentStepIndex();
        const current = this.timeTravelDebugger.getCurrentStep();
        const errorCount = steps.filter(s => s.kind === 'error').length;
        const callStack = current?.stack ?? [];

        const stepRows = steps.length === 0
            ? `<div class="empty">No execution history yet.<br/>Open a JavaScript or TypeScript file and run it to record each step.</div>`
            : steps.map(step => {
                const isCurrent = step.index === currentIndex;
                const dot = `<span class="dot" style="background:${this._kindColor(step.kind)}"></span>`;
                const ref = `<span class="ref">${step.line}:1</span>`;
                const expanded = isCurrent && step.full
                    ? `<pre class="full">${this._escapeHtml(step.full)}</pre>`
                    : '';
                const copyBtn = isCurrent && step.full
                    ? `<button class="icon copy" title="Copy value" onclick="event.stopPropagation();copy(${step.index})">⧉</button>`
                    : '';
                return `
                <div class="step ${isCurrent ? 'current' : ''}" onclick="goToStep(${step.index})">
                    <div class="step-head">
                        ${dot}
                        <span class="val">${this._escapeHtml(step.short)}</span>
                        ${ref}
                        ${copyBtn}
                    </div>
                    ${step.kind !== 'step' && step.lineText ? `<div class="src">${this._escapeHtml(step.lineText)}</div>` : ''}
                    ${expanded}
                </div>`;
            }).join('');

        const stackRows = callStack.length === 0
            ? '<div class="empty compact">No call stack for this step.</div>'
            : callStack.map((frame, index) => `
                <button class="frame ${index === 0 ? 'active' : ''}" onclick="goToLine(${frame.line})">
                    <span class="frame-name">${this._escapeHtml(frame.name)}</span>
                    <span class="ref">${frame.line}:${frame.column}</span>
                </button>`).join('');
        const counter = steps.length === 0 ? '0 / 0' : `${currentIndex + 1} / ${steps.length}`;
        const canBack = this.timeTravelDebugger.canStepBack();
        const canFwd = this.timeTravelDebugger.canStepForward();
        // Escape `<` so a value containing `</script>` can't break out of the embedded script.
        const fullForCopy = JSON.stringify(steps.map(s => s.full)).replace(/</g, '\\u003c');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    :root { color-scheme: dark; }
    body {
        margin: 0; padding: 0;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
    }
    .toolbar {
        display: flex; align-items: center; gap: 4px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--vscode-widget-border, #333);
    }
    .toolbar .title { font-weight: 600; letter-spacing: .08em; margin-right: 12px; }
    .toolbar button {
        background: transparent; border: none; cursor: pointer;
        color: var(--vscode-foreground); font-size: 16px; line-height: 1;
        padding: 4px 6px; border-radius: 4px;
    }
    .toolbar button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, #2a2d2e); }
    .toolbar button:disabled { opacity: .35; cursor: default; }
    .toolbar .counter { margin-left: auto; color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
    .columns { display: flex; }
    .logs { flex: 1; min-width: 0; padding: 8px 0; }
    .debug-sidebar {
        width: 260px; border-left: 1px solid var(--vscode-widget-border, #333);
        color: var(--vscode-descriptionForeground);
    }
    .error-count { padding: 10px 12px; }
    .error-count.has { color: #E06C75; }
    .section-title {
        font-weight: 600; letter-spacing: .06em; font-size: .85em;
        padding: 0 12px 6px; color: var(--vscode-descriptionForeground);
        border-bottom: 1px solid var(--vscode-widget-border, #333); margin-bottom: 6px;
    }
    .frame {
        width: 100%; display: flex; align-items: center; gap: 8px;
        padding: 7px 12px; border: 0; background: transparent;
        color: var(--vscode-foreground); text-align: left; cursor: pointer;
        font-family: var(--vscode-editor-font-family);
    }
    .frame:hover { background: var(--vscode-list-hoverBackground); }
    .frame.active { border-left: 2px solid var(--vscode-focusBorder); }
    .frame-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .step { padding: 6px 12px; cursor: pointer; border-left: 3px solid transparent; }
    .step:hover { background: var(--vscode-list-hoverBackground); }
    .step.current {
        background: var(--vscode-list-activeSelectionBackground);
        border-left-color: var(--vscode-focusBorder);
    }
    .step-head { display: flex; align-items: center; gap: 8px; }
    .dot { width: 9px; height: 9px; border-radius: 2px; flex: none; }
    .val {
        font-family: var(--vscode-editor-font-family); white-space: pre;
        overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
    }
    .ref { color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; font-size: .85em; }
    .icon { background: transparent; border: none; cursor: pointer; color: var(--vscode-foreground); opacity: .7; }
    .icon:hover { opacity: 1; }
    .src {
        font-family: var(--vscode-editor-font-family); font-size: .82em;
        color: var(--vscode-descriptionForeground); margin: 2px 0 0 17px; opacity: .8;
    }
    .full {
        font-family: var(--vscode-editor-font-family); font-size: .85em;
        background: var(--vscode-textCodeBlock-background, #1e1e1e);
        margin: 6px 0 0 17px; padding: 8px; border-radius: 4px;
        white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto;
    }
    .empty { padding: 40px 20px; text-align: center; color: var(--vscode-descriptionForeground); line-height: 1.6; }
    .empty.compact { padding: 16px 12px; font-size: .85em; }
    @media (max-width: 700px) {
        .columns { display: block; }
        .debug-sidebar { width: auto; border-left: 0; border-top: 1px solid var(--vscode-widget-border, #333); }
    }
</style>
</head>
<body>
    <div class="toolbar">
        <span class="title">KODA DEBUGGER</span>
        <button title="First (⏮)" onclick="cmd('firstStep')" ${canBack ? '' : 'disabled'}>⏮</button>
        <button title="Step back (◀)" onclick="cmd('stepBack')" ${canBack ? '' : 'disabled'}>◀</button>
        <button title="Step forward (▶)" onclick="cmd('stepForward')" ${canFwd ? '' : 'disabled'}>▶</button>
        <button title="Last (⏭)" onclick="cmd('lastStep')" ${canFwd ? '' : 'disabled'}>⏭</button>
        <button title="Clear history" onclick="cmd('clearHistory')">🗑</button>
        <button title="Toggle Time Travel" onclick="cmd('toggleTimeTravel')">⏻</button>
        <span class="counter">${counter}</span>
    </div>
    <div class="columns">
        <div class="logs">
            <div class="section-title">EXECUTION</div>
            ${stepRows}
        </div>
        <aside class="debug-sidebar">
            <div class="section-title">CALL STACK</div>
            ${stackRows}
            <div class="section-title">EXCEPTIONS</div>
            <div class="error-count ${errorCount > 0 ? 'has' : ''}">
                ${errorCount > 0 ? `${errorCount} ERROR${errorCount > 1 ? 'S' : ''}` : 'NO ERRORS'}
            </div>
        </aside>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const FULL = ${fullForCopy};
        function cmd(c) { vscode.postMessage({ command: c }); }
        function goToStep(i) { vscode.postMessage({ command: 'goToStep', index: i }); }
        function goToLine(line) { vscode.postMessage({ command: 'goToLine', line }); }
        function copy(i) { vscode.postMessage({ command: 'copy', text: FULL[i] }); }
    </script>
</body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    public dispose() {
        TimeTravelPanel.currentPanel = undefined;
        this._clearHighlight();
        this._lineHighlight.dispose();
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
