function checkOrGetAnchor(ev) {
  const subTargets = ev.subTargets;

  // return early if clicked on canvas
  if (subTargets.length === 0) return null;

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
      y2: y
    });

    connectorConfig.connectorLine.setCoords();
  } else {
    // object position in a group is relative to the center of the group
    // thus we need to add group center position to get the absolute
    // coordinates
    const x1 = connectorConfig.startAnchor.getCenterPoint().x + connectorConfig.startAnchor.group.getCenterPoint().x;
    const y1 = connectorConfig.startAnchor.getCenterPoint().y + connectorConfig.startAnchor.group.getCenterPoint().y;

    connectorConfig.connectorLine = new Line([
      x1,
      y1,
      x,
      y
    ]);

    canvas.add(connectorConfig.connectorLine);
  }

  canvas.renderAll();
}

function canvasMouseUpEventHandler(ev, canvas, connectorConfig) {
  if (!connectorConfig.isLineMode) return;

  // get target anchor
  const anchor = checkOrGetAnchor(ev);

  if (!anchor
    || connectorConfig.startAnchor == anchor
    || connectorConfig.startAnchor.group == anchor.group
    || connectorConfig.startAnchor.direction == anchor.direction) {
    // remove line from the canvas
    canvas.remove(connectorConfig.connectorLine);
  } else {
    // connect the line
    const x2 = anchor.getCenterPoint().x + anchor.group.getCenterPoint().x;
    const y2 = anchor.getCenterPoint().y + anchor.group.getCenterPoint().y;
    connectorConfig.connectorLine.set({
      x2,
      y2
    });
    connectorConfig.connectorLine.setCoords();
    connectorConfig.connectorLine.sendToBack();

    // output operator will be the one whose "input" anchor is
    // being connected to
    const [inputOperator, outputOperator] = anchor.direction === 'output' ?
      [anchor.group, connectorConfig.startAnchor.group] : [connectorConfig.startAnchor.group, anchor.group];

    outputOperator.inputs.push(inputOperator);

    // save line to anchors to update while moving the node
    connectorConfig.startAnchor.lineOutputs.push(connectorConfig.connectorLine);
    anchor.lineInputs.push(connectorConfig.connectorLine);
  }

  canvas.renderAll();
  unlockNodeMovement(connectorConfig.startAnchor.group);
  resetConnector(connectorConfig);
}

function run(target) {
  if (!target || !(target instanceof Node)) return;

  const jsonObj = {};
  const root = target.getOutput(jsonObj);

  // add root
  jsonObj['root'] = root;

  const query = decryptQueryData(jsonObj, root);
  const data = runQuery(window.db, query);

  const table = new window.AsciiTable('')
  const columns = data[0].columns;
  table.setHeading(...columns);
  for (const row of data[0].values) {
    table.addRow(...row);
  }

  const out = document.getElementById('js-output');
  out.innerText = table;
}

function registerButtonHandlers(canvas) {
  const symbolButtons = document.querySelectorAll('.js-buttons button');

  for (const btn of symbolButtons) {
    const buttonType = btn.dataset.type;
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();

      switch (buttonType) {
        case 'operator':
          const operatorType = btn.dataset.operatorType;
          console.log(operatorType);
          const kls = {
            'sigma': Sigma,
            'project': Project,
            'union': Union,
            'intersect': Intersect,
            'join': Join
          }[operatorType];

          // create, initialize, and add to canvas
          const operator = new kls();
          await operator.init();

          canvas.add(operator);
          break
        case 'table':
          const tableName = btn.dataset.tableName;
          const table = new Table({ tableName });
          await table.init();

          canvas.add(table);
          break
        case 'load':
          await loadSample();
          break
        case 'run':
          run(canvas.getActiveObject());
          break
        case 'clear':
          canvas.clearAll();
          break
        case 'delete':
          break
      }
    });
  }
}

function addEventListeners(canvas) {
  const connectorConfig = {
    isLineMode: false,
    connectorLine: null,
    startAnchor: null
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

  registerButtonHandlers(canvas);
}

async function loadSample() {
  window.db = await initDB();
  insertSampleData(db);
}

function initCanvas() {
  const canvasId = 'board';
  const canvasDom = document.getElementById(canvasId);

  const parentWidth = canvasDom.parentNode.offsetWidth;
  canvasDom.width = parentWidth;
  canvasDom.height = "600";

  const canvas = new fabric.Canvas(canvasId);

  // disable group selection
  canvas.selection = false;
  canvas.setHeight(600);
  canvas.setWidth(parentWidth);

  canvas.renderAll();

  addEventListeners(canvas);
}

// initialize everything and set event handlers
window.onload = async () => {
  initCanvas();
};