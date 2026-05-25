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
        backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'),
        border: '1px solid',
        borderColor: new vscode.ThemeColor('focusBorder'),
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
            'Koda Time Travel',
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

    private _highlightStep(step: ExecutionStep, reveal: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || step.line < 1 || step.line > editor.document.lineCount) {
            return;
        }
        const lineIdx = step.line - 1;
        const range = new vscode.Range(lineIdx, 0, lineIdx, editor.document.lineAt(lineIdx).text.length);
        editor.setDecorations(this._lineHighlight, [range]);
        if (reveal) {
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }

    private _clearHighlight() {
        vscode.window.activeTextEditor?.setDecorations(this._lineHighlight, []);
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

        const stepRows = steps.length === 0
            ? `<div class="empty">No execution history yet.<br/>Start live evaluation to watch your code run, step by step.</div>`
            : steps.map(step => {
                const isCurrent = step.index === currentIndex;
                const dot = `<span class="dot" style="background:${this._kindColor(step.kind)}"></span>`;
                const ref = `<span class="ref">${step.line}:1</span>`;
                const expanded = isCurrent
                    ? `<pre class="full">${this._escapeHtml(step.full)}</pre>`
                    : '';
                const copyBtn = isCurrent
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
                    ${step.lineText ? `<div class="src">${this._escapeHtml(step.lineText)}</div>` : ''}
                    ${expanded}
                </div>`;
            }).join('');

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
    .errors {
        width: 180px; border-left: 1px solid var(--vscode-widget-border, #333);
        padding: 12px; color: var(--vscode-descriptionForeground);
    }
    .errors.has { color: #E06C75; }
    .section-title {
        font-weight: 600; letter-spacing: .06em; font-size: .85em;
        padding: 0 12px 6px; color: var(--vscode-descriptionForeground);
        border-bottom: 1px solid var(--vscode-widget-border, #333); margin-bottom: 6px;
    }
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
</style>
</head>
<body>
    <div class="toolbar">
        <span class="title">KODA</span>
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
            <div class="section-title">LOGS</div>
            ${stepRows}
        </div>
        <div class="errors ${errorCount > 0 ? 'has' : ''}">
            ${errorCount > 0 ? `${errorCount} ERROR${errorCount > 1 ? 'S' : ''}` : 'NO ERRORS'}
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const FULL = ${fullForCopy};
        function cmd(c) { vscode.postMessage({ command: c }); }
        function goToStep(i) { vscode.postMessage({ command: 'goToStep', index: i }); }
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
