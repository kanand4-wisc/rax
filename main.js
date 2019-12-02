let isLineMode = false;
let connectorLine = null;
let startPoint = null;
let startAnchor = null;

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
        if (anchor == null || !anchor.type || anchor.type != 'anchor') {
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
        if (anchor == null || !anchor.type || anchor.type != 'anchor' || anchor == startAnchor) {
            canvas.remove(connectorLine);
        } else {
            endPoint = anchor.getCenterPoint();

            connectorLine.set({
                x2: endPoint.x,
                y2: endPoint.y
            });

            connectorLine.setCoords();

            // add line to respective anchors for update coordinates when moving
            anchor.lineInputs.push(connectorLine);
            startAnchor.lineOutputs.push(connectorLine);
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
    if (dir === 'bottom') {
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

function getOperator(type) {
    return new Promise((resolve) => {
        fabric.loadSVGFromURL(`/assets/${type}.svg`, function (objects, options) {
            operator = fabric.util.groupSVGElements(objects, options);
            operator.scale(type == 'sigma' ? 0.035 : 0.5);
            operator.set({ left: 100, top: 100 });
            operator.hasControls = false;
            operator.hasBorders = true;
            operator.type = 'operator';
            operator.anchors = [getAnchor(operator, 'top'), getAnchor(operator, 'bottom')];
            operator.inputs = [];
            operator.outputs = [];

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

            resolve(operator);
        });
    });
}

window.onload = (ev) => {
    const canvas = new fabric.Canvas('board');

    // disable group selection
    canvas.selection = false;

    registerCanvasEventHandlers(canvas);

    getOperator('sigma').then((operator) => {
        addOperator(operator, canvas);
    });

    getOperator('union').then((operator) => {
        addOperator(operator, canvas);
    });

    getOperator('intersect').then((operator) => {
        addOperator(operator, canvas);
    });

    getOperator('project').then((operator) => {
        addOperator(operator, canvas);
    });

    getOperator('join').then((operator) => {
        addOperator(operator, canvas);
    });
};
