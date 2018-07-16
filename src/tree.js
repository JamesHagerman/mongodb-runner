const vscode = require('vscode');
const { TreeItemCollapsibleState, EventEmitter, Uri } = require('vscode');
const { TreeNodeTypes } = require('mongodb-topology');
const _ = require('lodash');

const Connection = require('./connection');
const eventDispatch = require('./event-dispatcher');
const TreeItem = require('./tree-item');

const config = require('./config');
const IDS = {
  root: 0,
  dbs: 1,
  users: 2,
  roles: 3
};

const root = {
  label: 'MongoDB',
  id: IDS.root,
  tooltip: 'MongoDB',
  collapsibleState: TreeItemCollapsibleState.Collapsed,
};
const loadMongoTree = () => {
  const mongoConfig = config.getMongoConfiguration();
  if (mongoConfig.url) {
    return Connection.connectMongoDB(mongoConfig);
  }
  vscode
    .window
    .showInformationMessage('No Mongo Configuration.');
  return Promise.resolve();
}
let context;
class MongoTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.loaded = false;
    eventDispatch.on('set-collection-attributes', this.addCollectionAttributes.bind(this));
  }

  /**
   * The data structure 
   * @param {*} data 
   */
  loadTree(data) {
    if (!data) {
      return;
    }
    this.treeData = this.convertToTreeData(data);
    this._onDidChangeTreeData.fire();
    this.loaded = true;
  }

  convertToTreeData(data) {
    console.log('convert tree data ', data);
    const treeData = [];
    _.forOwn(data, (v, k) => {
      let resource;
      let name;
      switch(k) {
        case 'databases':
          name = 'Databases';
          break;
        case 'replicaset':
          name = 'Replica Set';
          break;
        default:
          name = k;
      }
      treeData.push({ name, type: k, children: v, resource });
    });
    return treeData;
  }

  addCollectionAttributes(event) {
    const dbs = this.treeData.find(d => d.type === TreeNodeTypes.DATABASES);
    const db = dbs.children.find(c => c.name === event.dbName);
    const col = db.collections.find(c => c.name === event.colName);
    col.attributes = event.attributes;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    if (element.id === IDS.root) {
      return element;
    }
    let children = this.getChildren(element);
    const collapsibleState = children && children.length > 0 ? TreeItemCollapsibleState.Collapsed : null;
    const treeItem = new TreeItem(element, collapsibleState);
    if (element.resource) {
    }
    return treeItem;
  }

  getChildren(element) {
    if (!element) {
      return [root];
    }
    if (element.id === IDS.root) {
      if (!this.isLoaded()) {
        return this.refresh();
      }
      return this.treeData;
    }
    let children = [];
    if (element.type === TreeNodeTypes.DATABASES) {
      children = element.children;
    } else if (element.type === TreeNodeTypes.DATABASE) {
      children = element.collections;
    } else if (element.type === TreeNodeTypes.COLLECTION) {
      if (element.indexes && element.indexes.length > 0) {
        children.push({ name: 'Indexes', children: element.indexes, type: TreeNodeTypes.INDEXES });
      }
      if (element.attributes && element.attributes.length > 0) {
        children.push({ name: 'Attributes', children: element.attributes, type: TreeNodeTypes.FIELDS });
      }
    } else if (element.type === TreeNodeTypes.SHARDS) {
      if(element.shards) {
        children = element.shards;
      } else {
        children = element.children;
      }
    }
     else{
      children = element.children;
    }
    return children;
  }

  refresh() {
    loadMongoTree().then(data => this.loadTree(data));
  }

  isLoaded() {
    return this.loaded;
  }
}

class TreeExplorer {
  constructor(ctx) {
    this.provider = new MongoTreeProvider();
    context=ctx;
    context
      .subscriptions
      .push(vscode.workspace.registerTextDocumentContentProvider('Data', this.provider));
    this.treeViewer = vscode
      .window
      .createTreeView('mongoRunner', { treeDataProvider: this.provider });
    this.registerCommands();

    const mongoConfig = config.getMongoConfiguration();
    if (mongoConfig.activeOnStartUp) {
      this.provider.refresh();
    }
  }

  registerCommands() {
    vscode
      .commands
      .registerCommand('mongoRunner.refresh', () => {
        vscode
          .window
          .showInformationMessage('Refresh Mongo Connection');
        this.provider.refresh();
      });
    vscode
      .commands
      .registerCommand('extension.mongoRunner.getConfiguration', () => {
        this.provider.refresh();
      })
  }
}

module.exports = TreeExplorer;
