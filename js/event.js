import { fabric } from 'fabric';
import AsciiTable from 'ascii-table';
import {
  Anchor,
  Line,
  Sigma,
  Join,
  Project,
  Table,
  Union,
  Intersect,
  Node,
} from './node';
import {
  initDB,
  insertSampleData,
  decryptQueryData,
  runQuery,
  getTableNames,
} from './db';

const getState = (() => {
  const state = {
    canvas: null,
    editor: null,
    db: null,
    dbname: null,
  };

  return () => state;
})();

function checkOrGetAnchor(ev) {
  const subTargets = ev.currentSubTargets || ev.subTargets;

  // return early if clicked on canvas
  if (!subTargets || subTargets.length === 0) return null;

  // we're only concerned with one anchor being clicked
  // and we want it to be an Anchor
  const target = subTargets[0];
  if (!(target instanceof Anchor)) return null;

  return target;
}

function resetConnector(connectorConfig) {
  connectorConfig.isLineMode = false;
  connectorConfig.connectorLine = null;
  connectorConfig.startAnchor = null;
}

function lockNodeMovement(node) {
  node.lockMovementY = true;
  node.lockMovementX = true;
}

function unlockNodeMovement(node) {
  node.lockMovementY = false;
  node.lockMovementX = false;
}

function canvasMouseDownEventHandler(ev, connectorConfig) {
  // return early if anchor not found
  const anchor = checkOrGetAnchor(ev);
  if (!anchor) return;

  // while creating a line stop the node from moving
  lockNodeMovement(anchor.group);

  connectorConfig.isLineMode = true;
  connectorConfig.startAnchor = anchor;
}

function canvasMouseMoveEventHandler(ev, canvas, connectorConfig) {
  if (!connectorConfig.isLineMode) return;

  const x = ev.e.offsetX;
  const y = ev.e.offsetY;

  if (connectorConfig.connectorLine) {
    connectorConfig.connectorLine.set({
      x2: x,
      y2: y,
    });

    connectorConfig.connectorLine.setCoords();
  } else {
    // object position in a group is relative to the center of the group
    // thus we need to add group center position to get the absolute
    // coordinates
    const x1 =
      connectorConfig.startAnchor.getCenterPoint().x +
      connectorConfig.startAnchor.group.getCenterPoint().x;
    const y1 =
      connectorConfig.startAnchor.getCenterPoint().y +
      connectorConfig.startAnchor.group.getCenterPoint().y;

    connectorConfig.connectorLine = new Line([x1, y1, x, y]);

    canvas.add(connectorConfig.connectorLine);
    canvas.sendToBack(connectorConfig.connectorLine);
  }

  canvas.renderAll();
}

function canvasMouseUpEventHandler(ev, canvas, connectorConfig) {
  if (!connectorConfig.isLineMode) return;

  // get target anchor
  const anchor = checkOrGetAnchor(ev);

  if (
    !anchor ||
    connectorConfig.startAnchor === anchor ||
    connectorConfig.startAnchor.group === anchor.group ||
    connectorConfig.startAnchor.direction === anchor.direction
  ) {
    // remove line from the canvas
    canvas.remove(connectorConfig.connectorLine);
  } else {
    // connect the line
    const x2 = anchor.getCenterPoint().x + anchor.group.getCenterPoint().x;
    const y2 = anchor.getCenterPoint().y + anchor.group.getCenterPoint().y;
    connectorConfig.connectorLine.set({
      x2,
      y2,
    });
    connectorConfig.connectorLine.setCoords();
    connectorConfig.connectorLine.sendToBack();

    // output anchor will be the one whose "input" anchor is
    // being connected to
    const [inputAnchor, outputAnchor] =
      anchor.direction === 'output'
        ? [anchor, connectorConfig.startAnchor]
        : [connectorConfig.startAnchor, anchor];

    connectorConfig.connectorLine.inputAnchor = inputAnchor;
    connectorConfig.connectorLine.outputAnchor = outputAnchor;

    const [inputOperator, outputOperator] = [
      inputAnchor.group,
      outputAnchor.group,
    ];
    outputOperator.inputs.push(inputOperator);

    // save line to anchors to update while moving the node
    connectorConfig.startAnchor.lineOutputs.push(connectorConfig.connectorLine);
    anchor.lineInputs.push(connectorConfig.connectorLine);
  }

  canvas.renderAll();
  unlockNodeMovement(connectorConfig.startAnchor.group);
  resetConnector(connectorConfig);
}

function deleteConnectorLine(line, canvas) {
  // remove line from both anchors
  line.inputAnchor.removeLine(line);
  line.outputAnchor.removeLine(line);

  line.outputAnchor.group.removeOperator(line.inputAnchor.group);

  canvas.remove(line);
}

function deleteNode(node, canvas) {
  const { anchors } = node;

  for (const anchor of anchors) {
    for (const line of anchor.lineInputs) {
      deleteConnectorLine(line, canvas);
    }

    for (const line of anchor.lineOutputs) {
      deleteConnectorLine(line, canvas);
    }
  }

  canvas.remove(node);
}

function deleteObject(target, canvas) {
  if (!target) return;

  if (target instanceof Node) deleteNode(target, canvas);
  else if (target instanceof Line) deleteConnectorLine(target, canvas);
}

function run(target) {
  const state = getState();

  if (!state.db) return;
  if (!target || !(target instanceof Node)) return;

  const jsonObj = {};
  const root = target.getOutput(jsonObj);

  // add root
  jsonObj.root = root;

  const query = decryptQueryData(jsonObj, root);
  const data = runQuery(state.db, query);

  const table = new AsciiTable('');
  const { columns } = data[0];
  table.setHeading(...columns);
  for (const row of data[0].values) {
    table.addRow(...row);
  }

  const out = document.getElementById('js-output');
  out.innerText = table;
}

function canvasOnSelectHandler(ev) {
  const activeObj = ev.target;
  activeObj.set({ backgroundColor: 'red' });
}

function createTableButtons(tableNames, canvas) {
  const parent = document.getElementById('js-table-btns');
  parent.innerHTML = '';

  const btnDivs = tableNames.map((tableName) => {
    const domElement = document.createElement('button');
    domElement.classList.add('btn');
    domElement.classList.add('btn-success');
    domElement.classList.add('me-1');

    domElement.setAttribute('data-type', 'table');
    domElement.setAttribute('data-table-name', tableName);
    domElement.setAttribute('type', 'submit');

    domElement.innerText = tableName;

    domElement.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const table = new Table({ tableName });
      await table.init();

      canvas.add(table);
    });

    return domElement;
  });

  parent.innerText = '';
  btnDivs.forEach((btnDiv) => parent.appendChild(btnDiv));
}

async function updateTableButtons() {
  const state = getState();

  const tableNames = await getTableNames(state.db);
  createTableButtons(tableNames, state.canvas);
}

async function loadSample() {
  const state = getState();

  state.db = await initDB();
  const currentDBDom = document.getElementById('js-current-db');
  currentDBDom.innerText = 'sample';
  insertSampleData(state.db);

  updateTableButtons();
}

async function executeSql(query) {
  if (!query) {
    return;
  }

  const state = getState();
  if (!state.db) {
    return;
  }

  let terminalOutput = query;
  try {
    const output = runQuery(state.db, query);
    terminalOutput = `${query}\n${output}`;
  } catch (err) {
    terminalOutput = `${query}\n${err.message}`;
  }
  document.getElementById('js-sql').value = terminalOutput;

  updateTableButtons();
}

async function clearSql() {
  const state = getState();

  document.getElementById('js-sql').value = '';
  state.editor.setValue('');
}

async function createDB() {
  const state = getState();

  state.db = await initDB();
  const currentDBDom = document.getElementById('js-current-db');
  currentDBDom.innerText = 'new db';
}

function registerButtonHandlers(canvas) {
  const symbolButtons = document.querySelectorAll('.js-buttons button');

  for (const btn of symbolButtons) {
    const buttonType = btn.dataset.type;
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();

      switch (buttonType) {
        case 'operator': {
          const { operatorType } = btn.dataset;
          const NodeClass = {
            sigma: Sigma,
            project: Project,
            union: Union,
            intersect: Intersect,
            join: Join,
          }[operatorType];

          // create, initialize, and add to canvas
          const operator = new NodeClass();
          await operator.init();

          canvas.add(operator);
          break;
        }
        case 'load':
          await loadSample(canvas);
          break;
        case 'create-db':
          await createDB();
          break;
        case 'execute-sql': {
          const query = document.getElementById('js-sql').value;

          await executeSql(query);
          break;
        }
        case 'clear-sql':
          await clearSql();
          break;
        case 'run':
          run(canvas.getActiveObject());
          break;
        case 'clear':
          canvas.clear();
          break;
        case 'delete':
          deleteObject(canvas.getActiveObject(), canvas);
          break;
        default:
          throw new Error('Invalid button');
      }
    });
  }
}

function addEventListeners(canvas) {
  const connectorConfig = {
    isLineMode: false,
    connectorLine: null,
    startAnchor: null,
  };

  canvas.on('mouse:down', (ev) => {
    canvasMouseDownEventHandler(ev, connectorConfig);
  });

  canvas.on('mouse:up', (ev) => {
    canvasMouseUpEventHandler(ev, canvas, connectorConfig);
  });

  canvas.on('mouse:move', (ev) => {
    canvasMouseMoveEventHandler(ev, canvas, connectorConfig);
  });

  canvas.on('object:selected', (ev) => {
    canvasOnSelectHandler(ev);
  });

  registerButtonHandlers(canvas);
}

function initCanvas() {
  const canvasId = 'board';
  const canvasDom = document.getElementById(canvasId);

  const canvasWidth = canvasDom.clientWidth;
  const canvasHeight = canvasDom.clientHeight;

  const canvas = new fabric.Canvas(canvasId);

  // disable group selection
  canvas.selection = false;
  canvas.setHeight(canvasHeight);
  canvas.setWidth(canvasWidth);

  canvas.renderAll();

  addEventListeners(canvas);

  const state = getState();
  state.canvas = canvas;
}

function initSqlEditor() {
  const editor = window.CodeMirror.fromTextArea(
    document.getElementById('js-sql'),
    {
      mode: 'text/x-mysql',
      viewportMargin: Infinity,
      indentWithTabs: true,
      smartIndent: true,
      lineNumbers: true,
      matchBrackets: true,
      autofocus: false,
      extraKeys: {},
    }
  );

  const state = getState();
  state.editor = editor;
}

export default function initApp() {
  initCanvas();
  initSqlEditor();
}
