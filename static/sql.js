import createSqlWasm from 'sql-wasm';

export function insertSampleData(db) {
  const sql = `
    CREATE TABLE A (a_id integer PRIMARY KEY, a integer NOT NULL, b text NOT NULL);
    INSERT INTO A VALUES (1, 1, "SF");;
    INSERT INTO A VALUES (2, 2, "MONT");
    INSERT INTO A VALUES (3, 3, "SF");
    INSERT INTO A VALUES (4, 5, "SF");
    INSERT INTO A VALUES (5, 6, "TX");
    INSERT INTO A VALUES (6, 7, "SJ");

    CREATE TABLE B (b_id integer PRIMARY KEY, b text NOT NULL, c integer NOT NULL);
    INSERT INTO B VALUES (1, "SF", 5);
    INSERT INTO B VALUES (2, "SJ", 5);
    INSERT INTO B VALUES (3, "TX", 5);
  `;

  db.run(sql);
}

export function runQuery(db, query) {
  return db.exec(query);
}

export function decryptQueryData(data, rootNode) {
  const nodeValue = data[rootNode];
  const { operator } = nodeValue;
  let query = null;

  if (operator === 'Project') {
    const inputTable = nodeValue.input;
    const colNames = nodeValue.colNames.split(',');

    let selectCol = '';
    for (const col of colNames) {
      selectCol += `${inputTable}.${col},`;
    }

    if (inputTable in data) {
      query = `Select ${selectCol.slice(0, selectCol.length - 1)} from (${decryptQueryData(data, inputTable)}) as ${inputTable}`;
    } else {
      query = `Select ${selectCol.slice(0, selectCol.length - 1)} from ${inputTable}`;
    }
  } else if (operator === 'Join') {
    const inputTables = nodeValue.input;
    let queryFirstTable;
    let querySecondTable;

    if (inputTables[0] in data) {
      queryFirstTable = `(${decryptQueryData(data, inputTables[0])}) as ${inputTables[0]}`;
    } else {
      [queryFirstTable] = inputTables;
    }

    if (inputTables[1] in data) {
      querySecondTable = `(${decryptQueryData(data, inputTables[1])}) as ${inputTables[1]}`;
    } else {
      [, querySecondTable] = inputTables;
    }

    query = `Select * from ${queryFirstTable} Natural JOIN ${querySecondTable}`;
  } else if (operator === 'Union') {
    const inputTables = nodeValue.input;
    let queryFirstTable;
    let querySecondTable;

    if (inputTables[0] in data) {
      queryFirstTable = decryptQueryData(data, inputTables[0]);
    } else {
      [queryFirstTable] = inputTables;
    }

    if (inputTables[1] in data) {
      querySecondTable = decryptQueryData(data, inputTables[1]);
    } else {
      [, querySecondTable] = inputTables;
    }

    query = `${queryFirstTable} Union ${querySecondTable}`;
  } else if (operator === 'Intersect') {
    const inputTables = nodeValue.input;
    let queryFirstTable;
    let querySecondTable;

    if (inputTables[0] in data) {
      queryFirstTable = decryptQueryData(data, inputTables[0]);
    } else {
      [queryFirstTable] = inputTables;
    }

    if (inputTables[1] in data) {
      querySecondTable = decryptQueryData(data, inputTables[1]);
    } else {
      [, querySecondTable] = inputTables;
    }

    query = `${queryFirstTable} Intersect ${querySecondTable}`;
  } else if (operator === 'Select') {
    const inputTable = nodeValue.input;
    const { condition } = nodeValue;

    if (inputTable in data) {
      query = `Select * from (${decryptQueryData(data, inputTable)}) as ${inputTable} where ${inputTable}.${condition}`;
    } else {
      query = `Select * from ${inputTable} where ${condition}`;
    }
  } else if (operator === 'Table') {
    const inputTable = nodeValue.input;
    query = `Select * from ${inputTable}`;
  }

  return query;
}

export async function getTableNames() {
  const sql = 'SELECT name FROM sqlite_master WHERE type="table"';
  const ret = window.db.exec(sql);

  return ret[0].values.map((val) => val[0]);
}

export async function initDB() {
  const sql = await createSqlWasm({
    wasmUrl: './sqlite3.wasm',
  });

  const db = new sql.Database();
  return db;
}
