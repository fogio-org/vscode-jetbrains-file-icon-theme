const vscode = require('vscode');
const GoTestIconsPlugin = require('./plugins/go-test-icons');

let outputChannel = vscode.window.createOutputChannel('JetBrains File Icon Theme');
let goTestIconsPlugin = null;

function activate(context) {
    outputChannel.appendLine('Extension activated');
    
    try {
        goTestIconsPlugin = new GoTestIconsPlugin();
        goTestIconsPlugin.activate(context);
        outputChannel.appendLine('Go Test Icons Plugin initialized successfully');
    } catch (error) {
        outputChannel.appendLine(`Error initializing Go Test Icons Plugin: ${error.message}`);
        outputChannel.appendLine(error.stack);
    }
}

function deactivate() {
    if (goTestIconsPlugin) {
        goTestIconsPlugin.deactivate();
        goTestIconsPlugin = null;
    }
    outputChannel.dispose();
}

module.exports = {
    activate,
    deactivate
}; 
