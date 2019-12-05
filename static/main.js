let isLineMode = false;
let connectorLine = null;
let startPoint = null;
let startAnchor = null;

function registerButtonHandlers(canvas) {
    const symbolButtons = document.querySelectorAll('.js-buttons button');

    for (const btn of symbolButtons) {
        const symbol = btn.dataset.symbol;
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();

            getOperator(symbol).then((operator) => {
                addOperator(operator, canvas);
            });
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
                selectable: false,
                evented: false,
            });

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

            connectorLine.setCoords();
            connectorLine.sendToBack();

            // add line to respective anchors for updating coordinates when moving
            anchor.lineInputs.push(connectorLine);
            startAnchor.lineOutputs.push(connectorLine);

            // update input/output for operators
            anchor.operator.inputs.push(startAnchor.operator);
        }

        canvas.renderAll();
        resetConnector();
    });
}

function addOperator(operator, canvas) {
    canvas.add(operator);

    for (const anchor of operator.anchors) {
        canvas.add(anchor);
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

/*
{
"root": "x1",
"x1": {
"operator": "Project",
"input": "x2",
"colNames": ["a"]
    },
"x2": {
"operator": "Join",
"input": ["x3", "x4"],
"joinColumn": "b"
    },
"x3": {
"operator": "Select",
"input": "A",
"condition": "a>3"
    },
"x4": {
"operator": "Select",
"input": "B",
"condition": "c==5"
    }
}
*/

let counter = 1;
function getVarName() {
    const varName = `x${counter}`;
    counter++;

    return varName;
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
        const joinColumn = operator.joinColumn;
        const key = getVarName();
        const input = [
            getOutputFromOperator(operator.inputs[0], jsonObj),
            getOutputFromOperator(operator.inputs[1], jsonObj)
        ];

        // insert key into the passed object
        jsonObj[key] = {
            "operator": "Join",
            "input": input,
            joinColumn
        };

        return key;
    } else if (operator.operType == 'table') {
        return operator.tableName;
    }
}

function getOperator(operType) {
    return new Promise((resolve) => {
        fabric.loadSVGFromURL(`static/assets/${operType}.svg`, function (objects, options) {
            operator = fabric.util.groupSVGElements(objects, options);
            operator.scale(operType == 'sigma' ? 0.035 : 0.5);
            operator.set({ left: 100, top: 100 });
            operator.hasControls = false;
            operator.hasBorders = false;
            operator.type = 'operator';
            operator.operType = operType != 'A' && operType != 'B' ? operType : 'table';
            operator.tableName = operType != 'A' && operType != 'B' ? null : operType;
            operator.anchors = [getAnchor(operator, 'output'), getAnchor(operator, 'input')];
            operator.inputs = [];

            if (operType == 'join') {
                operator.joinColumn = window.prompt('Enter join column');
            } else if (operType == 'sigma') {
                operator.condition = window.prompt('Enter condition');
            } else if (operType == 'project') {
                operator.colNames = window.prompt('Enter comma separated column names');
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
            });

            operator.on('mousedblclick', (ev) => {
                const operator = ev.target;

                // return if nothing is connected
                if (operator.inputs.length == 0) {
                    return;
                }
    
                const jsonObj = {};
                const root = getOutputFromOperator(operator, jsonObj);
    
                // add root
                jsonObj['root'] = root;

                console.log(jsonObj);
    
                fetch("/query", {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    method: "POST",
                    body: JSON.stringify(jsonObj)
                })
	        .then((resp) => resp.json()) // Transform the data into json
         	.then(function(data) {
			const out = document.getElementById('js-output');
			out.innerText = data.res;
		})
            });

            resolve(operator);
        });
    });
}

window.onload = (ev) => {
    const canvas = new fabric.Canvas('board');

    // disable group selection
    canvas.selection = false;

    registerCanvasEventHandlers(canvas);
    registerButtonHandlers(canvas);
};
