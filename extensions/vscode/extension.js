const vscode = require("vscode");

/**
 * @param {import("vscode").ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("reposcope.revealFile", async (relativePath, line, column) => {
      const folders = vscode.workspace.workspaceFolders;
      if (folders === undefined || folders.length === 0) {
        void vscode.window.showWarningMessage("RepoScope: open a workspace folder first.");
        return;
      }
      if (typeof relativePath !== "string" || relativePath.includes("..") || pathIsAbsolute(relativePath)) {
        void vscode.window.showWarningMessage("RepoScope: node id must be a workspace-relative path.");
        return;
      }
      const uri = vscode.Uri.joinPath(folders[0].uri, ...relativePath.split("/"));
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      if (typeof line === "number" && line >= 1) {
        const position = new vscode.Position(line - 1, typeof column === "number" && column >= 1 ? column - 1 : 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    }),
  );
}

function pathIsAbsolute(value) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function deactivate() {}

module.exports = { activate, deactivate };
