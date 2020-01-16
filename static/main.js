let isLineMode = false;
let connectorLine = null;
let startPoint = null;
let startAnchor = null;
let counter = 1;

function getVarName() {
  const varName = `x${counter}`;
  counter++;

  return varName;
}

function registerButtonHandlers(canvas) {
  const symbolButtons = document.querySelectorAll('.js-buttons button');

  for (const btn of symbolButtons) {
    const symbol = btn.dataset.symbol;
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();

      if (symbol == 'delete') {

        const activeObject = canvas.getActiveObject();
        if (!activeObject.type || activeObject.type != 'line') {
          return;
        }

        deleteConnectorLine(activeObject, canvas);

        return;
      }

      if (symbol == 'clear') {
        canvas.clear();

        // clear query output
        const out = document.getElementById('js-output');
        const nodeCostOut = document.getElementById('js-cost');
        out.innerText = "";
        nodeCostOut.innerText = "";

        return;
      }

      if (symbol == 'back') {
        const introDom = document.getElementById('js-intro');
        const raxDom = document.getElementById('js-rax');

        canvas.clear();
        window.db = null;

        // toggle between intro and rax modes
        introDom.classList.remove('hidden');
        raxDom.classList.add('hidden');

        return;
      }

      const operator = await getOperator(symbol);
      addOperator(operator, canvas);
    })
  }
}

function registerCanvasEventHandlers(canvas) {
  canvas.on('mouse:move', (ev) => {
    if (!isLineMode) {
      return;
    }

    const x = ev.e.offsetX;
    const y = ev.e.offsetY;

    if (connectorLine) {
      connectorLine.set({
        x2: x,
        y2: y
      });

      connectorLine.setCoords();
    } else {
      connectorLine = new fabric.Line([
        startPoint.x,
        startPoint.y,
        x,
        y
      ], {
        fill: 'black',
        stroke: 'black',
        strokeWidth: 3,
        selectable: true,
        evented: true,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true
      });

      connectorLine.type = 'line';

      canvas.add(connectorLine);
    }

    canvas.renderAll();
  });

  canvas.on('mouse:down', (ev) => {
    const anchor = ev.target;
    if (anchor == null || !anchor.type) {
      return;
    }

    if (anchor.type == 'operator') {
      return;
    }

    isLineMode = true;
    startPoint = anchor.getCenterPoint();
    startAnchor = anchor;
  });

  canvas.on('mouse:up', (ev) => {
    if (!isLineMode) {
      return;
    }

    // get target anchor
    const anchor = ev.target;

    // if we mouse up on the canvas or something that isn't an anchor
    if (anchor == null
      || !anchor.type
      || anchor.type != 'anchor'
      || anchor == startAnchor
      || anchor.operator == startAnchor.operator
      || startAnchor.dir == anchor.dir) {
      canvas.remove(connectorLine);
    } else {
      endPoint = anchor.getCenterPoint();
      connectorLine.set({
        x2: endPoint.x,
        y2: endPoint.y
      });

      // add line to respective anchors for updating coordinates when moving
      anchor.lineInputs.push(connectorLine);
      startAnchor.lineOutputs.push(connectorLine);

      connectorLine.startAnchor = startAnchor;
      connectorLine.endAnchor = anchor;

      // update input/output for operators
      if (anchor.dir == "input") {
        anchor.operator.inputs.push(startAnchor.operator);

        // update line data structure
        connectorLine.inputOperator = startAnchor.operator;
        connectorLine.outputOperator = anchor.operator;
      } else {
        startAnchor.operator.inputs.push(anchor.operator);

        // update line data structure
        connectorLine.inputOperator = anchor.operator;
        connectorLine.outputOperator = startAnchor.operator;
      }

      connectorLine.setCoords();
      connectorLine.sendToBack();
    }

    canvas.renderAll();
    resetConnector();
  });
}

function deleteConnectorLine(line, canvas) {
  const startAnchor = line.startAnchor;
  const endAnchor = line.endAnchor;
  const inputOperator = line.inputOperator;
  const outputOperator = line.outputOperator;

  let i = 0;
  for (i = 0; i < startAnchor.lineOutputs.length; ++i) {
    if (startAnchor.lineOutputs[i] == line) {
      break;
    }
  }

  startAnchor.lineOutputs.splice(i, 1);

  for (i = 0; i < endAnchor.lineInputs.length; ++i) {
    if (endAnchor.lineInputs[i] == line) {
      break;
    }
  }

  endAnchor.lineInputs.splice(i, 1);

  for (i = 0; i < outputOperator.inputs.length; ++i) {
    if (outputOperator.inputs[i] == inputOperator) {
      break;
    }
  }

  outputOperator.inputs.splice(i, 1);

  canvas.remove(line);
}

function addOperator(operator, canvas) {
  canvas.add(operator);

  for (const anchor of operator.anchors) {
    canvas.add(anchor);
  }

  if (operator.txt) {
    canvas.add(operator.txt);
  }
}

function getAnchorCoords(operator, dir) {
  const center = operator.getCenterPoint();
  const radius = operator.getBoundingRect().height / 2;

  const anchorLeft = center.x - 5;
  let anchorTop = center.y - 10 - radius - 1;
  if (dir === 'input') {
    anchorTop = center.y + radius + 1
  }

  return {
    anchorLeft,
    anchorTop
  };
}

function resetConnector() {
  isLineMode = false;
  startAnchor = null;
  startPoint = null;
  connectorLine = null;
}

function updateAnchorLines(anchor) {
  const center = anchor.getCenterPoint();

  for (const line of anchor.lineInputs) {
    line.set({
      x2: center.x,
      y2: center.y
    });

    line.setCoords();
  }

  for (const line of anchor.lineOutputs) {
    line.set({
      x1: center.x,
      y1: center.y
    });

    line.setCoords();
  }
}

function getAnchor(operator, dir) {
  const { anchorLeft, anchorTop } = getAnchorCoords(operator, dir);

  const anchor = new fabric.Circle({
    radius: 5,
    fill: '#ffc4c4',
    left: anchorLeft,
    top: anchorTop
  });

  anchor.hasControls = false;
  anchor.hasBorders = false;
  anchor.selectable = false;
  anchor.lockMovementY = true;
  anchor.lockMovementX = true;
  anchor.dir = dir;
  anchor.operator = operator;
  anchor.type = 'anchor';
  anchor.lineInputs = [];
  anchor.lineOutputs = [];

  return anchor;
}

function getTextBoxCoords(operator) {
  const center = operator.getCenterPoint();
  const radius = operator.getBoundingRect().height / 2;

  const textLeft = center.x + radius + 1;
  const textTop = center.y + radius + 1;

  return {
    textLeft,
    textTop
  };
}

function getTextBox(txt, operator) {
  const { textLeft, textTop } = getTextBoxCoords(operator);

  const textBox = new fabric.Text(txt,
    {
      left: textLeft,
      top: textTop,
      fontSize: 20
    });

  textBox.hasControls = false;
  textBox.hasBorders = false;
  textBox.selectable = false;
  textBox.lockMovementY = true;
  textBox.lockMovementX = true;

  return textBox;
}

function getOutputFromOperator(operator, jsonObj) {
  if (operator.operType == 'sigma') {
    const condition = operator.condition;
    const key = getVarName();
    const input = getOutputFromOperator(operator.inputs[0], jsonObj);

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Select",
      "input": input,
      condition
    };

    return key;
  } else if (operator.operType == 'project') {
    const colNames = operator.colNames;
    const key = getVarName();
    const input = getOutputFromOperator(operator.inputs[0], jsonObj);

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Project",
      "input": input,
      colNames
    };

    return key;
  } else if (operator.operType == 'join') {
    const key = getVarName();
    const input = [
      getOutputFromOperator(operator.inputs[0], jsonObj),
      getOutputFromOperator(operator.inputs[1], jsonObj)
    ];

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Join",
      "input": input,
    };

    return key;
  } else if (operator.operType == 'union') {
    const key = getVarName();
    const input = [
      getOutputFromOperator(operator.inputs[0], jsonObj),
      getOutputFromOperator(operator.inputs[1], jsonObj)
    ];

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Union",
      "input": input,
    };

    return key;
  } else if (operator.operType == 'intersect') {
    const key = getVarName();
    const input = [
      getOutputFromOperator(operator.inputs[0], jsonObj),
      getOutputFromOperator(operator.inputs[1], jsonObj)
    ];

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Intersect",
      "input": input,
    };

    return key;
  } else if (operator.operType == 'table') {
    const key = getVarName();

    // insert key into the passed object
    jsonObj[key] = {
      "operator": "Table",
      "input": operator.tableName,
    };

    return key;
  }
}

async function getOperator(operType) {
  const operator = await new Promise((resolve) => {
    fabric.loadSVGFromURL(`static/assets/${operType}.svg`, function (objects, options) {
      const operator = fabric.util.groupSVGElements(objects, options);
      operator.scale(operType == 'sigma' ? 0.035 : 0.5);
      operator.set({ left: 100, top: 100 });
      operator.hasControls = false;
      operator.hasBorders = false;

      resolve(operator);
    });
  });

  operator.type = 'operator';
  operator.operType = operType != 'A' && operType != 'B' ? operType : 'table';
  operator.tableName = operType != 'A' && operType != 'B' ? null : operType;
  operator.inputs = [];

  if (operType == 'join') {
    operator.anchors = [getAnchor(operator, 'output'), getAnchor(operator, 'input')];
  } else if (operType == 'sigma') {
    operator.condition = window.prompt('Enter condition');
    operator.txt = getTextBox(operator.condition, operator);
    operator.anchors = [getAnchor(operator, 'output'), getAnchor(operator, 'input')];
  } else if (operType == 'project') {
    operator.colNames = window.prompt('Enter comma separated column names');
    operator.txt = getTextBox(operator.colNames, operator);
    operator.anchors = [getAnchor(operator, 'output'), getAnchor(operator, 'input')];
  } else if (operator.operType == 'table') {
    operator.txt = getTextBox(operator.tableName, operator);
    operator.anchors = [getAnchor(operator, 'output')];
  } else {
    operator.anchors = [getAnchor(operator, 'output'), getAnchor(operator, 'input')];
  }

  // move anchors along with the operator
  operator.on('moving', (ev) => {
    const operator = ev.target;

    for (const anchor of operator.anchors) {
      const { anchorLeft, anchorTop } = getAnchorCoords(operator, anchor.dir);

      anchor.set({
        top: anchorTop,
        left: anchorLeft
      });

      anchor.setCoords();
      updateAnchorLines(anchor);
    }

    if (operator.txt) {
      const { textLeft, textTop } = getTextBoxCoords(operator);
      operator.txt.set({
        left: textLeft,
        top: textTop
      });

      operator.txt.setCoords();
    }
  });

  operator.on('mousedblclick', (ev) => {
    const operator = ev.target;

    // return if nothing is connected
    if (operator.inputs.length == 0 && operator.operType != 'table') {
      return;
    }

    const jsonObj = {};
    const root = getOutputFromOperator(operator, jsonObj);

    // add root
    jsonObj['root'] = root;

    const query = decryptQueryData(jsonObj, root);
    const data = runQuery(window.db, query);

    let cost = 0;

    const table = new window.AsciiTable('')
    const columns = data[0].columns;
    table.setHeading(...columns);
    for (const row of data[0].values) {
      table.addRow(...row);

      // calculate cost of query
      for (const obj of row) {
        if (typeof obj == 'string') {
          cost += obj.length;
        } else if (typeof obj == 'number') {
          cost += 8;
        }
      }
    }

    const nodeOutput = `Node Output : ${cost} bytes`;

    const out = document.getElementById('js-output');
    const nodeCostOut = document.getElementById('js-cost');

    out.innerText = table;
    nodeCostOut.innerText = nodeOutput;
  });

  return operator;
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

  registerCanvasEventHandlers(canvas);
  registerButtonHandlers(canvas);
}

async function loadSample() {
  window.db = await initDB();
  insertSampleData(db);
}

// initialize everything and set event handlers
window.onload = async (ev) => {
  const loadSampleButton = document.getElementById('js-loadsample');
  loadSampleButton.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const introDom = document.getElementById('js-intro');
    const raxDom = document.getElementById('js-rax');

    // toggle between intro and rax modes
    introDom.classList.add('hidden');
    raxDom.classList.remove('hidden');

    await loadSample();
    initCanvas();
  })
};
