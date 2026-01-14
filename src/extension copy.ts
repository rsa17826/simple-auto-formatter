// @name remove ai comments
// @regex \n *(//) [A-Z].*
// @replace
// @endregex
// @regex  (//) [A-Z].*
// @replace
// @endregex
// @name seperate functions
// @regex (?<=[^\n])\n(function \w+)
// @replace
//
// $1
// @endregex

import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"
Object.assign(global, console)
declare global {
  function log(...args: any[]): void
  function error(...args: any[]): void
  function warn(...args: any[]): void
  function info(...args: any[]): void
  function clear(...args: any[]): void
}

function getlang() {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showInformationMessage(
      "No active editor found. Please open a file."
    )
    return ""
  }
  const document = editor.document
  const cursorPosition = editor.selection.active
  const thisLine = cursorPosition.line
  var fulltext = document.getText()
  const scriptMatches = fulltext.matchAll(
    /(?<=<script\b[^>]*>)([\s\S]*?)(?=<\/script>)/g
  )
  let isThisLineInsideScriptTag = false
  for (const match of scriptMatches) {
    const matchStartPosition = document.positionAt(match.index)
    const matchEndPosition = document.positionAt(
      match.index + match[1].length
    )
    const matchEndLine = document.lineAt(matchEndPosition).lineNumber
    if (
      thisLine >= matchStartPosition.line &&
      thisLine <= matchEndLine
    ) {
      isThisLineInsideScriptTag = true
      break
    }
  }
  var langid = document.languageId
  if (langid == "html" && isThisLineInsideScriptTag)
    langid = "javascript"
  return langid
}

async function findAndReplaceInDirectory(directory: string) {
  const files = fs.readdirSync(directory)

  for (const file of files) {
    const filePath = path.join(directory, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      await findAndReplaceInDirectory(filePath)
    } else if (file.endsWith(".gd")) {
      const document = await vscode.workspace.openTextDocument(
        filePath
      )
      await replaceTabsInDocument(document)
    }
  }
}

async function replaceTabsInDocument(document: vscode.TextDocument) {
  const text = document.getText()
  const newText = text.replace(/\t/g, "    ")

  const edit = new vscode.WorkspaceEdit()
  edit.replace(
    document.uri,
    new vscode.Range(0, 0, document.lineCount, 0),
    newText
  )
  await vscode.workspace.applyEdit(edit)
  await document.save()
}

export function activate(context: vscode.ExtensionContext) {
  // warn("loaded")
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.replaceTabs",
      async () => {
        const editor = vscode.window.activeTextEditor

        if (editor) {
          for (const document of vscode.workspace.textDocuments) {
            if (document.fileName.endsWith(".gd")) {
              await replaceTabsInDocument(document)
            }
          }
        }

        const workspaceFolders = vscode.workspace.workspaceFolders
        if (workspaceFolders) {
          for (const folder of workspaceFolders) {
            await findAndReplaceInDirectory(folder.uri.fsPath)
          }
        }
      }
    )
  )
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const changes = event.contentChanges
      if (event.contentChanges.length === 0) {
        return
      }
      if (changes.length > 0) {
        var commentStarted: boolean = false
        var prevchange:
          | vscode.TextDocumentContentChangeEvent
          | undefined
        changes.forEach((change) => {
          if (getlang() == "css") {
            if (change.text == " */") {
              commentStarted = true
              prevchange = change
              return
            }
            if (
              prevchange &&
              commentStarted &&
              change.text == "/* "
            ) {
              fixCssComment(prevchange, change, "/* ", " */")
              return
            }
          }
          commentStarted = false
          if (!(change.rangeLength === 0 && change.text.length > 0))
            return
          if (change.rangeLength != 0) return
          // log("[", change.text, "]", change)
          if (/^\r?\n *$/.test(change.text)) {
            pressed("\n")
          } else if (change.text == " ") {
            pressed(" ")
          }
        })
      }
    })
  )
  function fixCssComment(
    prevchange: vscode.TextDocumentContentChangeEvent,
    change: vscode.TextDocumentContentChangeEvent,
    commentStart: string,
    commentEnd: string
  ) {
    // log("comment")
    // const editor = vscode.window.activeTextEditor
    // if (!editor) {
    //   vscode.window.showInformationMessage(
    //     "No active editor found. Please open a file."
    //   )
    //   return
    // }
    // const document = editor.document
    // var text: string = ""
    // var start = change.range.start.translate(0, 1)
    // var end = prevchange.range.end.translate(0, -1)
    // while (
    //   !(text.endsWith(commentEnd) && text.startsWith(commentStart))
    // ) {
    //   if (!text.startsWith(commentStart))
    //     start = start.translate(0, -1)
    //   if (!text.endsWith(commentEnd)) end = end.translate(0, 1)
    //   var range = new vscode.Range(start, end)
    //   text = document.getText(range)
    // }
    // var lines = text.split("\n").map((line) => {
    //   if (line.includes(commentStart) && line.includes(commentEnd)) {
    //     line = line
    //       .replaceAll(commentStart, "ƒ")
    //       .replaceAll(commentEnd, "ƒ")
    //     return line
    //   }
    // })
    // log(text)
    // log(text)
  }
  function pressed(key: string, langid: string = getlang()) {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showInformationMessage(
        "No active editor found. Please open a file."
      )
      return
    }
    const document = editor.document
    const cursorPosition = editor.selection.active
    const thisLine = cursorPosition.line
    const startingLineText = document.lineAt(cursorPosition.line).text
    var indent = startingLineText.match(/^\s*/)?.[0] || ""
    var offset = { line: 0, char: 0 }
    const atEnd =
      cursorPosition.character + 1 - Number(key == "\n") ===
      startingLineText.length
    var text = startingLineText
    // var langid = getlang()

    // log(document.languageId, langid)

    switch (langid) {
      case "python":
      case "gdscript":
        if (startingLineText.trim() == "else") {
          indent = indent.slice(0, -4)
          text = text.replace(/( *)else/, `${indent}else`)
        }

        // auto add :
        if (
          key == "\n"
          // && atEnd
        ) {
          const hasElseOnSameLine = /\bif\b.*\belse\b/.test(text)
          if (!hasElseOnSameLine) {
            text = text.replace(
              /(^[ \t]*\b(?:if|else|elif|for|while|def|class|match|case)\b *)([^:\n]*)(?<!:)( *$)/g,
              (_match, p1, p2) => {
                return `${p1}${p2.trim()}:\n${indent}    `
              }
            )
          }
        }

        break
      case "javascript":
      case "typescript":
        // auto add () after if
        if (key == " ") {
          if (atEnd) {
            var reg = /(^[^"'`]*)\b(if|for|while|switch|else +if) *$/g
            if (reg.test(text)) {
              text = text.replace(
                reg,
                (_, a, s) => `${a}${s} (${s == "for" ? "var " : ""})`
              )
              offset.char--
            }
            text = text.replace(
              /(?:var|const|let) ?(var|const|let)\s/g,
              "$1 "
            )
            // text = text.replaceAll(/ *([\(\{])/g, " $1")
          }
        } else if (key == "\n") {
          var reg =
            /(^ *)([^"'`]*)\b(?:(if|for|while|switch|else +if) *\((.+)\) *$|else *$)/g
          if (reg.test(text)) {
            text = text.replace(reg, `$&{\n  $1\n$1}`)
            text = text
              .replaceAll(/ *\{$/gm, " {")
              .replaceAll(/ *$/g, "")
              .replace(/(\}) *(\w+)/g, "$1 $2")
            offset.line--
            offset.char++
          }
        }
      default:
        log("document.languageId", document.languageId, langid)
    }
    if (text !== startingLineText) {
      // error(text)
      // apply changes
      editor.edit((editBuilder) => {
        if (key == "\n")
          editBuilder.replace(
            new vscode.Range(
              thisLine,
              0,
              thisLine + 1,
              document.lineAt(thisLine + 1).text.match(/ *$/)?.[0]
                ?.length ?? 0
            ),
            text
          )
        else
          editBuilder.replace(
            new vscode.Range(
              thisLine,
              0,
              thisLine,
              startingLineText.length
            ),
            text
          )
      })
      // .then(() => {
      // warn(text.split("\n"), text.split("\n").length)
      var newLine = thisLine + text.split("\n").length - 1
      var newCharacter = text.split("\n").pop()?.length || 0
      const newPosition = new vscode.Position(
        newLine + offset.line,
        newCharacter + offset.char
      )
      editor.selection = new vscode.Selection(
        newPosition,
        newPosition
      )
      // })
    }
  }
}
export function deactivate() {}
