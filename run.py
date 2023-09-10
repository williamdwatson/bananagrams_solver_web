from flask import Flask

app = Flask(__name__)

@app.route('/words')
def words():
    with open('dictionary.txt', 'r') as f:
        dictionary = f.read()
    with open('short_dictionary.txt', 'r') as f:
        short_dictionary = f.read()
    return {'short': short_dictionary, 'long': dictionary}

if __name__ == '__main__':
    app.run('0.0.0.0', port=5000)