from flask import Flask, request
import sqlite3
import os, json
from queryTranslate import decryptQueryData
from queryExecute import prepare_data

app = Flask(__name__)

@app.route('/', methods=['POST'])
def root():
    print(request.json)
    data = request.json
    rootNode = data.get("root")
    finalQuery = decryptQueryData(data, rootNode)
    #print("final query = ", finalQuery)

    cur = prepare_data()
    cur.execute(finalQuery)
    results = cur.fetchall()

    return " ".join(map(str, results))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
