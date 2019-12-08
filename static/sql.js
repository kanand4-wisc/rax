function insertSampleData(db) {
    const A_sql = "CREATE TABLE A (a_id integer PRIMARY KEY, a integer NOT NULL, b text NOT NULL);"
    db.run(A_sql);

    let insert_data = "INSERT INTO A VALUES (1, 1, 'SF');"
    db.run(insert_data)
    insert_data = "INSERT INTO A VALUES (2, 2, 'MONT');"
    db.run(insert_data)
    insert_data = "INSERT INTO A VALUES (3, 3, 'SF');"
    db.run(insert_data)
    insert_data = "INSERT INTO A VALUES (4, 5, 'SF');"
    db.run(insert_data)
    insert_data = "INSERT INTO A VALUES (5, 6, 'TX');"
    db.run(insert_data)
    insert_data = "INSERT INTO A VALUES (6, 7, 'SJ');"
    db.run(insert_data)

    B_sql = "CREATE TABLE B (b_id integer PRIMARY KEY, b text NOT NULL, c integer NOT NULL)"
    db.run(B_sql);

    insert_data = "INSERT INTO B VALUES (1, 'SF', 5);"
    db.run(insert_data)
    insert_data = "INSERT INTO B VALUES (2, 'SJ', 5);"
    db.run(insert_data)
    insert_data = "INSERT INTO B VALUES (3, 'TX', 5);"
    db.run(insert_data)
}

function runQuery (db, query) {
    return db.exec(query);
}

function decryptQueryData(data, rootNode) {
    const nodeValue = data[rootNode];
    const operator = nodeValue["operator"];
    let query = null;

    if (operator == "Project") {
        const inputTable = nodeValue["input"];
        const colNames = nodeValue["colNames"].split(",");
        
        let selectCol = "";
        for (const col of colNames) {
            selectCol += inputTable + "." + col + ",";
        }

        if (inputTable in data)
            query = "Select " + selectCol.slice(0, selectCol.length -  1) + " from (" + decryptQueryData(data, inputTable) + ") as " + inputTable
        else
            query = "Select " + selectCol.slice(0, selectCol.length - 1) + " from " + inputTable
    } else if (operator == "Join") {
        inputTables = nodeValue["input"]
        if (inputTables[0] in data)
            queryFirstTable = "(" + decryptQueryData(data, inputTables[0]) + ") as " + inputTables[0]
        else
            queryFirstTable = inputTables[0]

        if (inputTables[1] in data)
            querySecondTable = "(" + decryptQueryData(data, inputTables[1]) + ") as " + inputTables[1]
        else
            querySecondTable = inputTables[1]

        query = "Select * from " + queryFirstTable + " Natural JOIN " + querySecondTable;
    } else if (operator == "Union") {
        inputTables = nodeValue["input"]
        if (inputTables[0] in data)
            queryFirstTable = decryptQueryData(data, inputTables[0])
        else
            queryFirstTable = inputTables[0]

        if (inputTables[1] in data)
            querySecondTable = decryptQueryData(data, inputTables[1])
        else
            querySecondTable = inputTables[1]

        query = queryFirstTable + " Union " + querySecondTable;
    } else if (operator == "Intersect") {
        inputTables = nodeValue["input"]
        if (inputTables[0] in data)
            queryFirstTable = decryptQueryData(data, inputTables[0])
        else
            queryFirstTable = inputTables[0]

        if (inputTables[1] in data)
            querySecondTable = decryptQueryData(data, inputTables[1])
        else
            querySecondTable = inputTables[1]

        query = queryFirstTable + " Intersect " + querySecondTable;
    } else if (operator == "Select") {
        inputTable = nodeValue["input"]
        condition = nodeValue["condition"]

        if (inputTable in data)
            query = "Select * from (" + decryptQueryData(data, inputTable) + ") as " + inputTable + " where " + inputTable + "." + condition
        else
            query = "Select * from " + inputTable + " where " + condition
    } else if (operator == "Table") {
        inputTable = nodeValue["input"]
        query = "Select * from " + inputTable
    }

    return query
}

async function initDB() {
    const initSqlJs = window.initSqlJs;
    const SQL = await initSqlJs();

    // Create a database
    const db = new SQL.Database();

    return db;
}
