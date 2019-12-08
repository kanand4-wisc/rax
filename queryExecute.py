from queryTranslate import decryptQueryData
import sqlite3
import os, json


#============ Prepare Data ================
def prepare_data():
    filePath = './db.sqlite3'
    if os.path.exists(filePath):
        os.remove(filePath)
	
    con = sqlite3.connect(filePath)
    cur = con.cursor()

    A_sql = "CREATE TABLE A (a_id integer PRIMARY KEY, a integer NOT NULL, b text NOT NULL)"
    cur.execute(A_sql)

    insert_data = "INSERT INTO A VALUES (1, 1, 'SF')"
    cur.execute(insert_data)
    insert_data = "INSERT INTO A VALUES (2, 2, 'MONT')"
    cur.execute(insert_data)
    insert_data = "INSERT INTO A VALUES (3, 3, 'SF')"
    cur.execute(insert_data)
    insert_data = "INSERT INTO A VALUES (4, 5, 'SF')"
    cur.execute(insert_data)
    insert_data = "INSERT INTO A VALUES (5, 6, 'TX')"
    cur.execute(insert_data)
    insert_data = "INSERT INTO A VALUES (6, 7, 'SJ')"
    cur.execute(insert_data)

    B_sql = "CREATE TABLE B (b_id integer PRIMARY KEY, b text NOT NULL, c integer NOT NULL)"
    cur.execute(B_sql)

    insert_data = "INSERT INTO B VALUES (1, 'SF', 5)"
    cur.execute(insert_data)
    insert_data = "INSERT INTO B VALUES (2, 'SJ', 5)"
    cur.execute(insert_data)
    insert_data = "INSERT INTO B VALUES (3, 'TX', 5)"
    cur.execute(insert_data)
    
    return cur

#============== Execute Actual Query ========
def main():
    with open("sampleInput.json", "r") as query:
        data = json.load(query)
        rootNode = data.get("root")
        finalQuery = decryptQueryData(data, rootNode)

        print("final query = ", finalQuery)
        cur = prepare_data()
        cur.execute(finalQuery)
        results = cur.fetchall()
        print("Resuts of the Query")
        for row in results:
            print(row)

if __name__=="__main__":
    main()
