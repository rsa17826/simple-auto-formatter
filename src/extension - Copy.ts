// @noregex
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
Object.assign(global, console)
declare global {
  function log(...args: any[]): void
  function error(...args: any[]): void
  function warn(...args: any[]): void
  function info(...args: any[]): void
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
    const matchEndPosition = document.positionAt(match.index + match[1].length)
    const matchEndLine = document.lineAt(matchEndPosition).lineNumber
    if (thisLine >= matchStartPosition.line && thisLine <= matchEndLine) {
      isThisLineInsideScriptTag = true
      break
    }
  }
  var langid = document.languageId
  if (langid == "html" && isThisLineInsideScriptTag) langid = "javascript"
  return langid
}
export function activate(context: vscode.ExtensionContext) {
  warn("loaded")
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const changes = event.contentChanges
      if (changes.length > 0) {
        changes.forEach((change) => {
          if (change.rangeLength != 0) return
          log("[", change.text, "]", change)
          if (/^\r?\n *$/.test(change.text)) {
            pressed("\n")
          } else if (change.text == " ") {
            pressed(" ")
          }
        })
      }
    })
  )

  function pressed(key: string) {
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
    const atEnd = cursorPosition.character === startingLineText.length
    var text = startingLineText
    var langid = getlang()
    log(document.languageId, langid)
    switch (langid) {
      case "python":
        if (startingLineText.trim() == "else") {
          indent = indent.slice(0, -4)
          text = text.replace(/( *)else/, `${indent}else`)
        }

        // auto add :
        if (key == "\n" && atEnd) {
          const hasElseOnSameLine = /\bif\b.*\belse\b/.test(text)
          if (!hasElseOnSameLine) {
            text = text.replace(
              /(^[ \t]*\b(?:if|else|elif|for|while|def|class)\b *)([^:\n]*)(?<!:)( *$)/g,
              (_match, p1, p2) => {
                return `${p1}${p2.trim()}:\n${indent}    `
              }
            )
          }
        }

        // camelcase vars to _
        if (key === "\n" || key === " ") {
          text = text.replace(
            /(?<!\\)\b(?<!\\)[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g,
            (match) => {
              return (
                match.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() +
                (key == "\n" ? "\n" + indent : "")
              )
            }
          )
        }
        break
      case "javascript":
      case "typescript":
        // auto add () after if
        if (key == " ") {
          var reg = /(^ *)(if|for|while|switch|else +if) $/g
          if (reg.test(text)) {
            text = text.replace(reg, `$1$2 ()`)
            offset.char--
          }
        }
    }
    if (text !== startingLineText) {
      // error(text)
      // apply changes
      editor
        .edit((editBuilder) => {
          if (key == "\n")
            editBuilder.replace(
              new vscode.Range(thisLine, 0, thisLine + 1, 0),
              text
            )
          else
            editBuilder.replace(
              new vscode.Range(thisLine, 0, thisLine, startingLineText.length),
              text
            )
        })
        .then(() => {
          // warn(text.split("\n"), text.split("\n").length)
          var newLine = thisLine + text.split("\n").length - 1
          var newCharacter = text.split("\n").pop()?.length || 0
          const newPosition = new vscode.Position(
            newLine + offset.line,
            newCharacter + offset.char
          )
          editor.selection = new vscode.Selection(newPosition, newPosition)
        })
    }
  }
}
export function deactivate() {}
