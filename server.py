from flask import Flask, request, render_template
import sqlite3
import os
import json
from queryTranslate import decryptQueryData
from queryExecute import prepare_data

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/query', methods=['POST'])
def root():
    print(request.json)
    data = request.json
    rootNode = data.get("root")
    finalQuery = decryptQueryData(data, rootNode)
    cur = prepare_data()
    cur.execute(finalQuery)
    results = cur.fetchall()

    res = {
        "res": " ".join(map(str, results))
    }

    return json.dumps(res)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
