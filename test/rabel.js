let fetch = require('node-fetch')
let assert = require('assert')
let path = require('path')
let fs = require('fs-extra')
let $rdf = require('rdflib')
let rabel = require('../')
const TARGET_DIR = 'target-dir'

/*
package.json:
  "dependencies": {
    "node-fetch": "^1.7.3"
  },
  "devDependencies": {
    "mocha": "^4.0.1"
  },
*/

xdescribe('fetch', () => {
  [
    // These will pass.
    { url: 'http://localhost/', status: 200 },
    { url: 'http://localhost/999', status: 404 },
    { url: 'http://localhost:999/', catchString: 'ECONNREFUSED' },
    { url: 'http //localhost/999', catchString: 'absolute urls' },
    { url: '', catchString: 'absolute urls' },
    { url: null, catchString: 'must be a string' },
    { url: undefined, catchString: 'must be a string' },

    // These will fail without timeout.
    { url: 'http://localhost:999', status: 404 },
    { url: 'http://localhost/999', catchString: 'ECONNREFUSED' },
    { url: 'http //localhost:999', status: 404 },
    { url: 'http //localhost/999', catchString: 'ECONNREFUSED' }
  ].forEach(t => {
    if ('status' in t) {
      let msg = JSON.stringify(t.url) + ' should fetch a ' + t.status
      it(msg, () => {
        return fetch(t.url).then(res => {
          assert.equal(res.status, t.status)
        })
      })
    } else {
      let msg = JSON.stringify(t.url) + ' should fail with ' + t.catchString
      it(msg, done => {
        fetch(t.url)
          .then(res => {
            done(Error('unexpected success with status ' + res.status))
          }).catch(e => {
            assert.notEqual(e.message.indexOf(t.catchString), -1,
                            '"' + t.catchString + '" not found in "' + e.message + '"')
            done()
          }).catch(e => {
            done(e) // report failed assertion from previous block.
            // Without this catch, done isn't called and mocha times out.
          })
      })
    }
  })
})

describe('rabel', () => {
  [
    { file: 'resource1.ttl' }
  ].forEach(t => {
    if ('file' in t) {
      let filePath = path.join(__dirname, t.file)
      it('should load and spray ' + filePath, done => {
        let kb = $rdf.graph()
        let fetcher = $rdf.fetcher(kb, {a:1})
        let doc = kb.sym('file://' + filePath)
        try {
          fs.removeSync(TARGET_DIR)
        } catch (e) {
        }
        fs.mkdirSync(TARGET_DIR)
        process.chdir(TARGET_DIR)
        fetcher.nowOrWhenFetched(doc, {}, function (ok, body, xhr) {
          // rabel.check(ok, body, xhr ? xhr.status : undefined)
          console.log('Loaded  ' + doc)
          rabel.spray(
            'http://a.example/',
            doc,
            msg => done(msg),
            kb,
            () => done()
          )
        })
      })
    }
  })
})
