const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { constants: fsConstants } = require('fs');

const CONFIG_SECTION = 'jetbrains-file-icon-theme';
const CONFIG_ENABLE_GO_TEST_ICONS = `${CONFIG_SECTION}.enableGoTestIcons`;
const REFRESH_DEBOUNCE_MS = 150;

class GoTestIconsPlugin {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('JetBrains File Icon Theme');
        this.refreshTimer = null;
        this.refreshInFlight = Promise.resolve();
        this.context = null;
        this.themePaths = null;
        this.hasShownWriteWarning = false;
    }

    activate(context) {
        this.context = context;
        this.themePaths = this.getThemePaths(context.extensionPath);

        this.outputChannel.appendLine('Go Test Icons Plugin activated');

        context.subscriptions.push(
            this.outputChannel,
            vscode.commands.registerCommand('jetbrains-file-icon-theme.updateGoTestIcons', () => {
                this.outputChannel.appendLine('Manual refresh triggered');
                this.scheduleRefresh();
            }),
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration(CONFIG_ENABLE_GO_TEST_ICONS)) {
                    this.outputChannel.appendLine('Configuration changed');
                    this.scheduleRefresh();
                }
            }),
            vscode.workspace.onDidCreateFiles((event) => {
                this.outputChannel.appendLine(`Files created: ${event.files.length}`);
                this.scheduleRefresh();
            }),
            vscode.workspace.onDidDeleteFiles((event) => {
                this.outputChannel.appendLine(`Files deleted: ${event.files.length}`);
                this.scheduleRefresh();
            }),
            vscode.workspace.onDidRenameFiles((event) => {
                this.outputChannel.appendLine(`Files renamed: ${event.files.length}`);
                this.scheduleRefresh();
            })
        );

        this.scheduleRefresh();
    }

    getThemePaths(extensionPath) {
        const themePath = path.join(extensionPath, 'themes');
        return {
            dark: path.join(themePath, 'dark-jetbrains-icon-theme.json'),
            light: path.join(themePath, 'light-jetbrains-icon-theme.json'),
            auto: path.join(themePath, 'auto-jetbrains-icon-theme.json'),
        };
    }

    scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            this.refreshInFlight = this.refreshInFlight
                .then(() => this.refreshGoTestIcons())
                .catch((error) => {
                    this.outputChannel.appendLine(`Refresh failed: ${error.message}`);
                    if (error.stack) {
                        this.outputChannel.appendLine(error.stack);
                    }
                });
        }, REFRESH_DEBOUNCE_MS);
    }

    async refreshGoTestIcons() {
        const enabled = vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .get('enableGoTestIcons', false);

        this.outputChannel.appendLine(`Go Test Icons enabled: ${enabled}`);

        const testFileNames = enabled ? await this.findWorkspaceTestFileNames() : new Set();
        this.outputChannel.appendLine(`Resolved ${testFileNames.size} unique Go test file names`);

        await this.syncAllThemes(testFileNames);
    }

    async findWorkspaceTestFileNames() {
        const files = await vscode.workspace.findFiles('**/*_test.go');
        const fileNames = new Set();

        for (const file of files) {
            fileNames.add(path.basename(file.fsPath));
        }

        return fileNames;
    }

    async syncAllThemes(testFileNames) {
        const writable = await this.ensureThemesAreWritable();
        if (!writable) {
            return;
        }

        await this.syncThemeFile(this.themePaths.dark, {
            defaultIconId: 'file_go_test',
            testFileNames,
        });

        await this.syncThemeFile(this.themePaths.light, {
            defaultIconId: 'file_go_test_light',
            testFileNames,
        });

        await this.syncThemeFile(this.themePaths.auto, {
            defaultIconId: 'file_go_test',
            lightIconId: 'file_go_test_light',
            testFileNames,
        });
    }

    async ensureThemesAreWritable() {
        try {
            await Promise.all(
                Object.values(this.themePaths).map((themePath) => fs.access(themePath, fsConstants.W_OK))
            );
            return true;
        } catch (error) {
            const message =
                'Go test icons cannot update theme files in the installed extension directory. ' +
                'This can happen in read-only or remote environments.';

            this.outputChannel.appendLine(message);
            this.outputChannel.appendLine(error.message);

            if (!this.hasShownWriteWarning) {
                this.hasShownWriteWarning = true;
                void vscode.window.showWarningMessage(message);
            }

            return false;
        }
    }

    async syncThemeFile(themePath, options) {
        const theme = await this.readTheme(themePath);
        if (!theme) {
            return;
        }

        let changed = false;

        changed = this.syncFileNamesMap(
            theme,
            options.testFileNames,
            options.defaultIconId
        ) || changed;

        if (options.lightIconId) {
            if (!theme.light || typeof theme.light !== 'object') {
                theme.light = {};
                changed = true;
            }

            changed = this.syncFileNamesMap(
                theme.light,
                options.testFileNames,
                options.lightIconId
            ) || changed;
        }

        if (!changed) {
            this.outputChannel.appendLine(`Theme already up to date: ${path.basename(themePath)}`);
            return;
        }

        await fs.writeFile(themePath, `${JSON.stringify(theme, null, 4)}\n`, 'utf8');
        this.outputChannel.appendLine(`Theme synchronized: ${path.basename(themePath)}`);
    }

    async readTheme(themePath) {
        try {
            const raw = await fs.readFile(themePath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to read ${themePath}: ${error.message}`);
            return null;
        }
    }

    syncFileNamesMap(target, desiredTestFileNames, iconId) {
        const current = target.fileNames && typeof target.fileNames === 'object'
            ? target.fileNames
            : {};

        const next = {};

        for (const [fileName, value] of Object.entries(current)) {
            if (!fileName.endsWith('_test.go')) {
                next[fileName] = value;
            }
        }

        for (const fileName of Array.from(desiredTestFileNames).sort()) {
            next[fileName] = iconId;
        }

        const changed = !this.shallowEqual(current, next);
        if (changed || !target.fileNames) {
            target.fileNames = next;
        }

        return changed;
    }

    shallowEqual(left, right) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);

        if (leftKeys.length !== rightKeys.length) {
            return false;
        }

        for (const key of leftKeys) {
            if (left[key] !== right[key]) {
                return false;
            }
        }

        return true;
    }

    deactivate() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        this.outputChannel.dispose();
    }
}

module.exports = GoTestIconsPlugin;
