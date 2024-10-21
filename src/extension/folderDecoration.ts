import { existsSync, lstatSync, readFileSync } from "fs";
import lcovParse from "lcov-parse";
import { join } from "path";
import * as vscode from "vscode";

const getCoverageDirectory = (uri: vscode.Uri): string | undefined => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return undefined;
    }

    const candidatePaths = uri.fsPath.split("/");

    for (let i = candidatePaths.length - 1; i >= 0; i--) {
        const candidatePath = candidatePaths.slice(0, i).join("/");
        const coveragePath = join(candidatePath, "coverage");
        if (existsSync(coveragePath) && lstatSync(coveragePath).isDirectory()) {
            return coveragePath;
        }
    }

    return undefined;
};

const getCoverageBadge = async (uri: vscode.Uri) => {
    const coverageRoot = getCoverageDirectory(uri);
    if (!coverageRoot) {
        return undefined;
    }
    const coverageFilePath = join(coverageRoot, "lcov.info");
    const fileContent = readFileSync(coverageFilePath, "utf-8");

    const percentage = await new Promise<number>((resolve, reject) => {
        const parse = lcovParse.source;

        parse(fileContent, (err, data) => {
            if (err) {
                return reject(err);
            }

            const fileCoverage = data.find((file) =>
                uri.fsPath.endsWith(file.file)
            );
            if (!fileCoverage) {
                return resolve(0);
            }

            const totalLines = fileCoverage.lines.found;
            const coveredLines = fileCoverage.lines.hit;
            const coveragePercentage = Math.floor(
                (coveredLines / totalLines) * 100
            );
            resolve(coveragePercentage);
        });
    });

    const tooltip = `Coverage: ${percentage.toFixed(2)}%`;

    if (percentage < 50) {
        return {
            badge: String(percentage),
            tooltip: tooltip,
            color: new vscode.ThemeColor(
                "terminalCommandDecoration.errorBackground"
            ),
        };
    }

    if (percentage === 100) {
        return {
            badge: "✔",
            tooltip: tooltip,
            color: new vscode.ThemeColor("testing.iconPassed"),
        };
    }

    return {
        badge: String(percentage),
        tooltip: tooltip,
        color: new vscode.ThemeColor("testing.Queued"),
    };
};

// A custom FileDecorationProvider class
export class FolderDecoration implements vscode.FileDecorationProvider {
    // EventEmitter to fire decoration changes
    private _onDidChangeFileDecorations = new vscode.EventEmitter<
        vscode.Uri | vscode.Uri[]
    >();
    readonly onDidChangeFileDecorations: vscode.Event<
        vscode.Uri | vscode.Uri[]
    > = this._onDidChangeFileDecorations.event;

    provideFileDecoration(
        uri: vscode.Uri
    ): vscode.ProviderResult<vscode.FileDecoration> {
        return getCoverageBadge(uri);
    }
}
