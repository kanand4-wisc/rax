import { fabric } from 'fabric';
import AsciiTable from 'ascii-table';
import {
  Anchor, Line, Sigma, Join, Project, Table, Union, Intersect, Node,
} from './node';
import {
  initDB, insertSampleData, decryptQueryData, runQuery, getTableNames,
} from './sql';

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
    const x1 = connectorConfig.startAnchor.getCenterPoint().x
      + connectorConfig.startAnchor.group.getCenterPoint().x;
    const y1 = connectorConfig.startAnchor.getCenterPoint().y
      + connectorConfig.startAnchor.group.getCenterPoint().y;

    connectorConfig.connectorLine = new Line([
      x1,
      y1,
      x,
      y,
    ]);

    canvas.add(connectorConfig.connectorLine);
    canvas.sendToBack(connectorConfig.connectorLine);
  }

  canvas.renderAll();
}

function canvasMouseUpEventHandler(ev, canvas, connectorConfig) {
  if (!connectorConfig.isLineMode) return;

  // get target anchor
  const anchor = checkOrGetAnchor(ev);

  if (!anchor
    || connectorConfig.startAnchor === anchor
    || connectorConfig.startAnchor.group === anchor.group
    || connectorConfig.startAnchor.direction === anchor.direction) {
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
    const [inputAnchor, outputAnchor] = anchor.direction === 'output'
      ? [anchor, connectorConfig.startAnchor] : [connectorConfig.startAnchor, anchor];

    connectorConfig.connectorLine.inputAnchor = inputAnchor;
    connectorConfig.connectorLine.outputAnchor = outputAnchor;

    const [inputOperator, outputOperator] = [inputAnchor.group, outputAnchor.group];
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
  if (!window.db) return;
  if (!target || !(target instanceof Node)) return;

  const jsonObj = {};
  const root = target.getOutput(jsonObj);

  // add root
  jsonObj.root = root;

  const query = decryptQueryData(jsonObj, root);
  const data = runQuery(window.db, query);

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

  const btnDivs = tableNames.map((tableName) => {
    const domElement = document.createElement('div');
    domElement.innerHTML = `
      <div class="row mt-2">
        <div class="col-sm-2"></div>
        <div class="col-sm-8">
          <button 
            class="btn btn-success btn-block" 
            data-type="table" 
            data-table-name="${tableName}" 
            type="submit">
            ${tableName}
          </button>
        </div>
      </div>
    `;

    domElement.querySelector('button').addEventListener('click', async (ev) => {
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

async function loadSample(canvas) {
  window.db = await initDB();
  const currentDBDom = document.getElementById('js-current-db');
  currentDBDom.innerText = 'sample';
  insertSampleData(window.db);

  const tableNames = await getTableNames();
  createTableButtons(tableNames, canvas);
}

function execSql() {
  const sql = document.getElementById('js-sql').value;
  if (!sql) return;

  window.db.run(sql);
}

async function createDB() {
  window.db = await initDB();
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
        case 'exec-sql':
          execSql();
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

export default function initCanvas() {
  const canvasId = 'board';
  const canvasDom = document.getElementById(canvasId);

  const parentWidth = canvasDom.parentNode.offsetWidth;
  canvasDom.width = parentWidth;
  canvasDom.height = '600';

  const canvas = new fabric.Canvas(canvasId);

  // disable group selection
  canvas.selection = false;
  canvas.setHeight(600);
  canvas.setWidth(parentWidth);

  canvas.renderAll();

  addEventListeners(canvas);
}
