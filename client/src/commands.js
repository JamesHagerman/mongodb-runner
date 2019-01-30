const vscode = require('vscode');
const { VM } = require('vm2');
const os = require('os');
const {
  getMongoInspector,
  connectMongoDB,
  ConnectStatus,
  getConnectionConfig,
  getAllConnectionConfigs
} = require('./connection');
const { eventDispatcher, EventType } = require('./event-dispatcher');
const { convertToTreeData } = require('./tree-data-converter');
const { editorComments } = require('./license');
const {
  pushEditor,
  getActivateEditorWrapper,
  connectOutputEditor
} = require('./editor-mgr');

const LanguageID = 'mongodbRunner';

const openTextDocument = (text, language) => {
  return vscode.workspace.openTextDocument({ content: text, language });
};

const openTextInEditor = (text, language = 'json', format=true) => {
  let doc;
  return openTextDocument(text, language)
    .then(d => {
      doc = d;
      return vscode.window.showTextDocument(doc, 1, true);
    })
    .then(editor => {
      format && vscode.commands.executeCommand('editor.action.formatDocument');
      return { doc, editor };
    });
};

const openMongoRunnerEditor = (text, uuid, dbName) => {
  let viewColumn;
  let wrapper;
  return openTextInEditor(text, LanguageID, false)
    .then(({ doc, editor }) => {
      wrapper = pushEditor(editor, uuid, dbName);
      viewColumn = editor.viewColumn + 1;
      // open output document
      return openTextDocument('', 'jsonc');
    })
    .then(doc => vscode.window.showTextDocument(doc, viewColumn, true))
    .then(editor => connectOutputEditor(wrapper, editor));
};

const connectDatabase = config => {
  return connectMongoDB(config)
    .then(data => {
      const treeData = convertToTreeData(data);
      console.log('tree data:', treeData);
      eventDispatcher.emit(
        EventType.Connect,
        Object.assign(treeData, { uuid: config.uuid, driver: data.driver })
      );
    })
    .catch(err => {
      console.error(err);
      vscode.window.showErrorMessage('Failed to connect!');
    });
};

const disconnectDatabase = db => {
  console.log('disconnect db ', db);
  if (db && db.driver) {
    db.driver
      .close()
      .then(() => {
        vscode.window.showInformationMessage('MongoDB Connection Closed.');
        eventDispatcher.emit(EventType.Disconnect, db.uuid);
      })
      .catch(err => {
        console.error(err);
        vscode.window.showErrorMessage('Failed to close connection.');
      });
  }
};

const serverStatusHandler = e => {
  const inspector = getMongoInspector(e.uuid);
  inspector
    .serverStats()
    .then(stats => {
      return openTextInEditor(JSON.stringify(stats, undefined, 4));
    })
    .catch(err => console.error(err));
};

const serverBuildInfoHandler = e => {
  const inspector = getMongoInspector(e.uuid);
  inspector
    .buildInfo()
    .then(stats => {
      return openTextInEditor(JSON.stringify(stats, undefined, 4));
    })
    .catch(err => console.error(err));
};

const deleteDatabase = e => {
  vscode.window
    .showInformationMessage(
      `Are you sure to delete database ${e.dbName}?`,
      { modal: true },
      'Yes'
    )
    .then(res => {
      if (res === 'Yes') {
        getMongoInspector(e.uuid)
          .deleteDatabase(e.dbName)
          .then(() => refreshConnectionUUID(e.uuid))
          .catch(err => vscode.window.showErrorMessage(err));
      }
    });
};

const deleteCollection = e => {
  vscode.window
    .showInformationMessage(
      `Are you sure to delete collection ${e.colName} in ${e.dbName} database?`,
      { modal: true },
      'Yes'
    )
    .then(res => {
      if (res === 'Yes') {
        getMongoInspector(e.uuid)
          .deleteCollection(e.dbName, e.colName)
          .then(() => refreshConnectionUUID(e.uuid))
          .catch(err => vscode.window.showErrorMessage(err));
      }
    });
};

const getCollectionAttributes = e => {
  const inspector = getMongoInspector(e.uuid);
  return inspector
    .getCollectionAttributes(e.dbName, e.name)
    .then(attributes => {
      eventDispatcher.emit(EventType.FindCollectionAttributes, {
        dbName: e.dbName,
        colName: e.name,
        attributes,
        uuid: e.uuid
      });
    })
    .catch(err => console.error(err));
};

const createIndex = e => {
  vscode.window
    .showInputBox({ placeHolder: '{"fieldA": 1, "fieldB": -1}' })
    .then(result => {
      if (result) {
        try {
          const idxParam = JSON.parse(result);
          return getMongoInspector(e.uuid).createIndex(
            e.dbName,
            e.colName,
            idxParam
          );
        } catch (err) {
          vscode.window.showErrorMessage(err.message);
        }
      }
    })
    .then(ret => {
      if (ret) {
        vscode.window.showInformationMessage('Create index: ' + ret);
        refreshConnectionUUID(e.uuid);
      }
    });
};

const launchMREditor = event => {
  const colName = event.colName ? event.colName : 'COLLECTION_NAME';
  return openMongoRunnerEditor(
    `${editorComments}${os.EOL}db.collection('${colName}').find()`,
    event.uuid,
    event.dbName
  );
};

const getIndex = e => {
  getMongoInspector(e.uuid)
    .getCollectionIndexes(e.dbName, e.name)
    .then(indexes => {
      console.log('get indexes ', indexes);
      openTextInEditor(JSON.stringify(indexes), 'json');
    })
    .catch(err => console.error(err));
};

const simpleQuery = e => {
  vscode.window
    .showInputBox({ placeHolder: 'query json condition' })
    .then(res => {
      try {
        if (res) {
          return getMongoInspector(e.uuid).simpleQuery(
            e.dbName,
            e.name,
            JSON.parse(res)
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(err.message);
      }
    })
    .then(docs => {
      if (docs) {
        openTextInEditor(JSON.stringify(docs), 'json');
      }
    });
};

const findFirst20Docs = e => {
  return getMongoInspector(e.uuid)
    .simpleQuery(e.dbName, e.name)
    .then(docs => openTextInEditor(JSON.stringify(docs), 'json'))
    .catch(err => vscode.window.showErrorMessage(err));
};

const deleteIndex = e => {
  vscode.window
    .showInformationMessage(
      `Are you sure to delete index ${e.name} in collection ${e.dbName}.${e.colName}?`,
      { modal: true },
      'Yes'
    )
    .then(res => {
      if (res === 'Yes') {
        getMongoInspector(e.uuid)
          .deleteIndex(e.dbName, e.colName, e.name)
          .then(() => {
            refreshConnectionUUID(e.uuid);
          })
          .catch(err => vscode.window.showErrorMessage(err));
      }
    });
};

const refreshConnectionUUID = uuid => {
  const config = getConnectionConfig(uuid);
  if (config) {
    refreshConnection(config);
  }
};

const refreshConnection = e => {
  console.log('refresh ', e);
  return connectDatabase(e);
};

const refreshAllConnections = () => {
  const treeData = global.treeExplorer.provider.treeData;
  if (treeData) {
    treeData.forEach(data => {
      if (data.status === ConnectStatus.CONNECTED) {
        refreshConnectionUUID(data.uuid);
      }
    });
  }
};

const isUUIDActivate = (uuid) => {
  const treeData = global.treeExplorer.provider.treeData;
  if (treeData) {
    const matched = treeData.find(data => data.uuid === uuid);
    return matched && matched.status === ConnectStatus.CONNECTED
  }
  return false;
};

const runCommand = (uuid, command, dbName) => {
  return new Promise((resolve, reject) => {
    const inspector = getMongoInspector(uuid);
    const db = inspector.driver.db(dbName);
    try {
      const vm = new VM({ sandbox: { db } });
      const result = vm.run(command);
      if (result && typeof result.then === 'function') {
        result.then(ret => resolve(ret)).catch(err => reject(err));
      } else {
        console.log('return value:', result);
        resolve(result);
      }
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
};

const showResult = (originCmd, result, editorWrapper) => {
  let jsonData;
  let prom;
  try {
    jsonData = JSON.stringify(result, null, 4);
  } catch (err) {}
  if (!jsonData) {
    jsonData = result;
  }
  const output = `// MongoRunner> ${originCmd}${os.EOL}${jsonData}`;
  if (editorWrapper.outputEditor) {
    // append output on exsited editor
    const { outputEditor } = editorWrapper;
    const lastLine = editorWrapper.outputEditor.document.lineAt(
      outputEditor.document.lineCount - 1
    );
    const position = new vscode.Position(
      lastLine.lineNumber,
      lastLine.range.end.character
    );
    if (
      !vscode.window.visibleTextEditors.find(
        editor => editor.id === outputEditor.id
      )
    ) {
      // the editor is not shown
      prom = openTextDocument(output + '', 'jsonc');
    } else {
      return editorWrapper.outputEditor.edit(editBuilder => {
        editBuilder.insert(
          position,
          position.character === 0 ? output + '' : os.EOL + output
        );
        const range = new vscode.Range(position, position);
        editorWrapper.outputEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);
      });
    }
  } else {
    // there is no editor output
    prom = openTextDocument(output + '', 'jsonc');
  }
  if (!prom || !prom.then) return Promise.resolve();
  return prom
    .then(doc => {
      if (doc) {
        let viewColumn = editorWrapper.editor.viewColumn + 1;
        if (editorWrapper.outputEditor) {
          viewColumn = editorWrapper.outputEditor.viewColumn;
        }
        return vscode.window.showTextDocument(doc, viewColumn, true);
      }
    })
    .then(editor => {
      if (editor) {
        connectOutputEditor(editorWrapper, editor);
      }
    });
};

/**
 * The command is triggered by code lens.
 * TODO: whether need to select different server
 * @param {*} event
 */
const executeCommand = event => {
  const configs = getAllConnectionConfigs();
  if (!configs || configs.length === 0) {
    return;
  }
  const editorWrapper = getActivateEditorWrapper();
  if (!editorWrapper) {
    return;
  }
  if(!isUUIDActivate(editorWrapper.uuid)){
    vscode.window.showErrorMessage('Connection is closed.');
    return;
  }
  return runCommand(editorWrapper.uuid, event, editorWrapper.dbName)
    .then(result => {
      return showResult(event, result, editorWrapper);
    })
    .catch(err => {
      console.error(err);
      return showResult(event, err.message, editorWrapper);
    });
};

const getActiveEditorText = () => {
  const wrapper = getActivateEditorWrapper();
  if(wrapper) {
    return wrapper.editor.document.getText();
  }
};

const executeAllCommands = () => {
  const text = getActiveEditorText();
  global.client.sendRequest('executeAll', text)
  .then(res => {
    console.log('res:', res);
    if (res) {
      const cmds = res.split(os.EOL);
      cmds.reduce((accu, current) => {
        return accu.then(() => executeCommand(current));
      }, Promise.resolve());
      executeCommand(res);
    }
  })
  .catch(err => console.error(err));
};

const clearOutputCommand = () => {
  const wrapper = getActivateEditorWrapper();
  if (wrapper && wrapper.outputEditor) {
    wrapper.outputEditor.edit(editBuilder => {
      const document = wrapper.outputEditor.document;
      const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(document.lineCount, 0));
      editBuilder.delete(range);
    });
  }
};

const registerCommands = () => {
  vscode.commands.registerCommand('mongoRunner.refresh', refreshAllConnections);
  // server command
  vscode.commands.registerCommand('mongoRunner.hostConnect', connectDatabase);
  vscode.commands.registerCommand(
    'mongoRunner.hostDisconnect',
    disconnectDatabase
  );
  vscode.commands.registerCommand('mongoRunner.hostRefresh', refreshConnection);
  vscode.commands.registerCommand(
    'mongoRunner.serverStatus',
    serverStatusHandler
  );
  vscode.commands.registerCommand(
    'mongoRunner.serverBuildInfo',
    serverBuildInfoHandler
  );

  // database commands
  vscode.commands.registerCommand('mongoRunner.deleteDatabase', deleteDatabase);

  //collection commands
  vscode.commands.registerCommand(
    'mongoRunner.getCollectionAttributes',
    getCollectionAttributes
  );
  vscode.commands.registerCommand('mongoRunner.getIndex', getIndex);
  vscode.commands.registerCommand('mongoRunner.createIndex', createIndex);
  vscode.commands.registerCommand('mongoRunner.simpleQuery', simpleQuery);
  vscode.commands.registerCommand(
    'mongoRunner.findFirst20Docs',
    findFirst20Docs
  );
  vscode.commands.registerCommand(
    'mongoRunner.deleteCollection',
    deleteCollection
  );

  // index commands
  vscode.commands.registerCommand('mongoRunner.deleteIndex', deleteIndex);

  vscode.commands.registerCommand('mongoRunner.launchEditor', launchMREditor);
  vscode.commands.registerCommand('mongoRunner.executeAllCommands', executeAllCommands);

  vscode.commands.registerCommand('mongoRunner.executeCommand', executeCommand);
  vscode.commands.registerCommand('mongoRunner.queryPlanner', executeCommand);
  vscode.commands.registerCommand('mongoRunner.clearOutput', clearOutputCommand);
};

module.exports = {
  registerCommands
};
