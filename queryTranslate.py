import json

def decryptQueryData(data, rootNode):
    nodeValue = data.get(rootNode)
    operator = nodeValue.get("operator")

    if operator == "Project":
        inputTable = nodeValue.get("input")
        colNames = nodeValue.get("colNames")
        
        selectCol = ""
        for col in colNames:
            selectCol += inputTable + "." + col + ","
        if inputTable in data:
            query = "Select " + selectCol[:-1] + " from (" + decryptQueryData(data, inputTable) + ") as " + inputTable
        else:
            query = "Select " + selectCol[:-1] + " from " + inputTable

    if operator == "Join":
        inputTables = nodeValue.get("input")
        joinCol = nodeValue.get("joinColumn")
        if inputTables[0] in data:
            queryFirstTable = "(" + decryptQueryData(data, inputTables[0]) + ") as " + inputTables[0]
        else:
            queryFirstTable = inputTables[0]

        if inputTables[1] in data:
            querySecondTable = "(" + decryptQueryData(data, inputTables[1]) + ") as " + inputTables[1]
        else:
            querySecondTable = inputTables[1]

        query = "Select * from " + queryFirstTable + ", " + querySecondTable + " where " + inputTables[0] + "." + joinCol + "==" + inputTables[1] + "." + joinCol

    if operator == "Select":
        inputTable = nodeValue.get("input")
        condition = nodeValue.get("condition")

        if inputTable in data:
            query = "Select * from (" + decryptQueryData(data, inputTable) + ") as " + inputTable + " where " + inputTable + "." + condition
        else:
            query = "Select * from " + inputTable + " where " + condition
    
    return query

def main():
    print("Query Translate!")
    with open("sampleInput.json", "r") as query:
        data = json.load(query)
    #print(type(data))
    rootNode = data.get("root")
    finalQuery = decryptQueryData(data, rootNode)
    print(finalQuery)
        
if __name__== "__main__":
    main()
