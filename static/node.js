async function getAsset(name, scale) {
    const assetURL = `static/assets/${name}.svg`;

    const asset = await new Promise((resolve) => {
        fabric.loadSVGFromURL(assetURL, (objects, options) => {
            const asset = fabric.util.groupSVGElements(objects, options);
            asset.scale(scale);
            asset.hasControls = false;
            asset.hasBorders = false;

            resolve(asset);
        });
    });

    return asset;
}

class Line extends fabric.Line {
    constructor(points) {
        super(points, {
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
    }
}

class Anchor extends fabric.Circle {
    constructor({ radius, fill, left, top, direction }) {
        super({
            radius,
            fill,
            left,
            top,
            originX: 'center',
            originY: 'center'
        });

        this.direction = direction;
        this.lineInputs = [];
        this.lineOutputs = [];
    };
}

function getAnchor({ nodeCenterPoint, assetRadius, direction }) {
    const margin = 5;
    const radius = 5;
    const fill = '#ffc4c4';
    const left = nodeCenterPoint.x;
    const top = direction === 'input' ?
        nodeCenterPoint.y + assetRadius + margin + radius :
        nodeCenterPoint.y - assetRadius - margin - radius;

    const anchor = new Anchor({
        radius,
        fill,
        left,
        top,
        direction
    });

    return anchor;
}

function getTextBox({ text, nodeCenterPoint, assetRadius }) {
    const margin = 5;
    const fontSize = 20;
    const left = nodeCenterPoint.x + assetRadius + margin;
    const top = nodeCenterPoint.y;

    const textBox = new fabric.Text(text, {
        fontSize,
        left,
        top,
        originY: 'center'
    });

    return textBox;
}

class Node extends fabric.Group {
    async init() {
        const asset = await getAsset(this.assetName, this.assetScale);
        asset.set({
            left: this.getCenterPoint().x,
            top: this.getCenterPoint().y,
            originX: 'center',
            originY: 'center'
        });
        this.addWithUpdate(asset);

        const assetRadius = asset.getBoundingRect().height / 2;

        // we want to center everything around the asset
        // so calculate and save it right now
        const nodeCenterPoint = this.getCenterPoint();

        if (this.hasInput) {
            const inputAnchor = getAnchor({
                nodeCenterPoint,
                assetRadius,
                direction: 'input'
            });

            this.addWithUpdate(inputAnchor);
            this.anchors.push(inputAnchor);
        }

        if (this.hasOutput) {
            const outputAnchor = getAnchor({
                nodeCenterPoint,
                assetRadius,
                direction: 'output'
            });

            this.addWithUpdate(outputAnchor);
            this.anchors.push(outputAnchor);
        }

        if (this.text) {
            const textBox = getTextBox({
                text: this.text,
                nodeCenterPoint,
                assetRadius
            });

            this.addWithUpdate(textBox);
        }
    }

    onMoveHandler() {
        for (const anchor of this.anchors) {
            const x = anchor.getCenterPoint().x + anchor.group.getCenterPoint().x;
            const y = anchor.getCenterPoint().y + anchor.group.getCenterPoint().y;

            for (const line of anchor.lineInputs) {
                line.set({
                    x2: x,
                    y2: y
                });

                line.setCoords();
            }

            for (const line of anchor.lineOutputs) {
                line.set({
                    x1: x,
                    y1: y
                });

                line.setCoords();
            }
        }
    }

    constructor({ assetName, assetScale, text, hasInput, hasOutput }) {
        // initialize empty group
        super([], {
            left: 100,
            top: 100,
            hasControls: false,
            hasBorders: false,
            selectable: true,
            subTargetCheck: true
        });

        this.assetName = assetName;
        this.assetScale = assetScale;
        this.text = text;
        this.anchors = [];
        this.hasInput = hasInput;
        this.hasOutput = hasOutput;

        this.on('moving', () => this.onMoveHandler());
    }
}

class Table extends Node {
    constructor({ tableName }) {
        super({
            assetName: tableName,
            text: tableName,
            hasInput: false,
            hasOutput: true,
            assetScale: 0.5
        });
    }
}

class Operator extends Node {
    constructor({ operatorName, assetScale, operatorText }) {
        super({
            assetName: operatorName,
            text: operatorText,
            hasInput: true,
            hasOutput: true,
            assetScale
        });

        this.inputs = [];
    }
}

class Sigma extends Operator {
    constructor() {
        const operatorName = 'sigma';
        const assetScale = 0.030;
        const condition = 'a > 3';

        super({
            operatorName,
            assetScale,
            operatorText: condition
        });
    }
}

class Project extends Operator {
    constructor() {
        const operatorName = 'project';
        const assetScale = 0.5;
        const colNames = window.prompt('Enter comma separated column names');

        super({
            operatorName,
            assetScale,
            operatorText: colNames
        });
    }
}

class Join extends Operator {
    constructor() {
        const operatorName = 'join';
        const assetScale = 0.5;

        super({
            operatorName,
            assetScale,
            operatorText: null
        });
    }
}

class Union extends Operator {
    constructor() {
        const operatorName = 'union';
        const assetScale = 0.5;

        super({
            operatorName,
            assetScale,
            operatorText: null
        });
    }
}

class Intersect extends Operator {
    constructor() {
        const operatorName = 'intersect';
        const assetScale = 0.5;

        super({
            operatorName,
            assetScale,
            operatorText: null
        });
    }
}
