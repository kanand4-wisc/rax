import { fabric } from 'fabric';

const symbolMap = {
  sigma: 'σ',
  project: '∏',
  join: '⋈',
  union: '∪',
  intersect: '∩',
  table: '🗂',
};

async function getAsset(name) {
  const assetSymbol = symbolMap[name] || symbolMap.table;
  const textBox = new fabric.Text(assetSymbol, {
    fontSize: 50,
  });

  return textBox;
}

const getVarName = (() => {
  let counter = 1;

  return () => {
    const varName = `x${counter}`;
    counter += 1;

    return varName;
  };
})();

export class Line extends fabric.Line {
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
      lockRotation: true,
    });

    this.inputAnchor = null;
    this.outputAnchor = null;
  }
}

export class Anchor extends fabric.Circle {
  constructor({
    radius, fill, left, top, direction,
  }) {
    super({
      radius,
      fill,
      left,
      top,
      originX: 'center',
      originY: 'center',
    });

    this.direction = direction;
    this.lineInputs = [];
    this.lineOutputs = [];
  }

  removeLine(line) {
    let i = 0;
    for (i = 0; i < this.lineOutputs.length; i += 1) {
      if (this.lineOutputs[i] === line) {
        break;
      }
    }
    this.lineOutputs.splice(i, 1);

    for (i = 0; i < this.lineInputs.length; i += 1) {
      if (this.lineInputs[i] === line) {
        break;
      }
    }
    this.lineInputs.splice(i, 1);
  }
}

function getAnchor({ nodeCenterPoint, assetRadius, direction }) {
  const margin = 5;
  const radius = 5;
  const fill = '#ffc4c4';
  const left = nodeCenterPoint.x;
  const top = direction === 'input'
    ? nodeCenterPoint.y + assetRadius + margin + radius
    : nodeCenterPoint.y - assetRadius - margin - radius;

  const anchor = new Anchor({
    radius,
    fill,
    left,
    top,
    direction,
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
    originY: 'center',
  });

  return textBox;
}

export class Node extends fabric.Group {
  constructor({
    assetName, assetScale, text, hasInput, hasOutput,
  }) {
    // initialize empty group
    super([], {
      left: 100,
      top: 100,
      hasControls: false,
      hasBorders: true,
      selectable: true,
      subTargetCheck: true,
    });

    this.assetName = assetName;
    this.assetScale = assetScale;
    this.text = text;
    this.anchors = [];
    this.hasInput = hasInput;
    this.hasOutput = hasOutput;

    this.on('moving', () => this.onMoveHandler());
  }

  async init() {
    const asset = await getAsset(this.assetName, this.assetScale);
    asset.set({
      left: this.getCenterPoint().x,
      top: this.getCenterPoint().y,
      originX: 'center',
      originY: 'center',
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
        direction: 'input',
      });

      this.addWithUpdate(inputAnchor);
      this.anchors.push(inputAnchor);
    }

    if (this.hasOutput) {
      const outputAnchor = getAnchor({
        nodeCenterPoint,
        assetRadius,
        direction: 'output',
      });

      this.addWithUpdate(outputAnchor);
      this.anchors.push(outputAnchor);
    }

    if (this.text) {
      const textBox = getTextBox({
        text: this.text,
        nodeCenterPoint,
        assetRadius,
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
          y2: y,
        });

        line.setCoords();
      }

      for (const line of anchor.lineOutputs) {
        line.set({
          x1: x,
          y1: y,
        });

        line.setCoords();
      }
    }
  }
}

export class Table extends Node {
  constructor({ tableName }) {
    super({
      assetName: tableName,
      text: tableName,
      hasInput: false,
      hasOutput: true,
      assetScale: 0.5,
    });

    this.tableName = tableName;
  }

  getOutput(jsonObj) {
    const key = getVarName();

    jsonObj[key] = {
      operator: 'Table',
      input: this.tableName,
    };

    return key;
  }
}

class Operator extends Node {
  constructor({ operatorName, assetScale, operatorText }) {
    super({
      assetName: operatorName,
      text: operatorText,
      hasInput: true,
      hasOutput: true,
      assetScale,
    });

    this.inputs = [];
  }

  removeOperator(operator) {
    let i;
    for (i = 0; i < this.inputs.length; i += 1) {
      if (this.inputs[i] === operator) {
        break;
      }
    }

    this.inputs.splice(i, 1);
  }
}

export class Sigma extends Operator {
  constructor() {
    const operatorName = 'sigma';
    const assetScale = 0.030;
    const condition = window.prompt('Enter condition');

    super({
      operatorName,
      assetScale,
      operatorText: condition,
    });

    this.condition = condition;
  }

  getOutput(jsonObj) {
    const key = getVarName();
    const input = this.inputs[0].getOutput(jsonObj);

    jsonObj[key] = {
      operator: 'Select',
      input,
      condition: this.condition,
    };

    return key;
  }
}

export class Project extends Operator {
  constructor() {
    const operatorName = 'project';
    const assetScale = 0.5;
    const colNames = window.prompt('Enter comma separated column names');

    super({
      operatorName,
      assetScale,
      operatorText: colNames,
    });

    this.colNames = colNames;
  }

  getOutput(jsonObj) {
    const key = getVarName();
    const input = this.inputs[0].getOutput(jsonObj);

    jsonObj[key] = {
      operator: 'Project',
      input,
      colNames: this.colNames,
    };

    return key;
  }
}

export class Join extends Operator {
  constructor() {
    const operatorName = 'join';
    const assetScale = 0.5;

    super({
      operatorName,
      assetScale,
      operatorText: null,
    });
  }

  getOutput(jsonObj) {
    const key = getVarName();
    const input = [
      this.inputs[0].getOutput(jsonObj),
      this.inputs[1].getOutput(jsonObj),
    ];

    jsonObj[key] = {
      operator: 'Join',
      input,
    };

    return key;
  }
}

export class Union extends Operator {
  constructor() {
    const operatorName = 'union';
    const assetScale = 0.5;

    super({
      operatorName,
      assetScale,
      operatorText: null,
    });
  }

  getOutput(jsonObj) {
    const key = getVarName();
    const input = [
      this.inputs[0].getOutput(jsonObj),
      this.inputs[1].getOutput(jsonObj),
    ];

    jsonObj[key] = {
      operator: 'Union',
      input,
    };

    return key;
  }
}

export class Intersect extends Operator {
  constructor() {
    const operatorName = 'intersect';
    const assetScale = 0.5;

    super({
      operatorName,
      assetScale,
      operatorText: null,
    });
  }

  getOutput(jsonObj) {
    const key = getVarName();
    const input = [
      this.inputs[0].getOutput(jsonObj),
      this.inputs[1].getOutput(jsonObj),
    ];

    jsonObj[key] = {
      operator: 'Intersect',
      input,
    };

    return key;
  }
}
