#!/usr/local/bin/node
// Utility Data conversion program.
//
// Test platform for parsers and serializers
//
//

var base = 'file://' + process.cwd() + '/'
var helpMessage =
'Utilty data converter for linked data\n' +
'\n' +
'Commands in unix option form are executed left to right, and include:\n' +
'\n' +
'-base=rrrr    Set the current base URI (relative URI, default is ' + base + ')\n' +
'-clear        Clear the current store\n' +
'-dump         Serialize the current store in current content type\n' +
'-format=cccc  Set the current content-type\n' +
'-help         This message \n' +
'-in=uri       Load a web resource or file\n' +
'-out=filename Output in eth current content type\n' +
'-report=file  set the report file destination for future validation\n' +
'-size         Give the current store\n' +
'-spray=base   Write out linked data to lots of different linked files CAREFUL!\n' +
'-test=manifest   Run tests as described in the test manifest\n' +
'-validate=shapeFile   Run a SHACL validator on the data loaded by previous in=x\n' +
'-version      Give the version of this program\n' +
'\n' +
'Formats are given as MIME types, such as text/turtle (default), application/rdf+xml, etc\n' +
'In input only, can parse application/xml, with smarts about IANA and GPX files.\n' +
'\n'  + 'Default base URI: ' + base + '\n'

var $rdf = require('rdflib')
var fs = require('fs')
var ShapeChecker = require('./../shacl-check/src/shacl-check.js')

var kb = $rdf.graph()
var fetcher = $rdf.fetcher(kb)

const RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
const a = RDF('type')
const mf = $rdf.Namespace('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#')
const sht = $rdf.Namespace('http://www.w3.org/ns/shacl/test-suite#')


var contentType = 'text/turtle'
var reportDocument, targetDocument

var testHandlers = []
var registerTest = function(klass, handler){
  testHandlers[klass.uri || klass] = handler
}

var check = function (ok, message, status) {
  if (!ok) {
    console.log('Failed ' + status + ': ' + message)
    process.exit(2)
  }
}

var exitMessage = function (message) {
  console.log(message)
  process.exit(4)
}

var doNext = function (remaining) {

  var loadDocument = function (right) {

    var doc = $rdf.sym($rdf.uri.join(right, base))
    targetDocument = targetDocument || doc // remember first doc
    // console.log("Document is " + targetDocument)
    if (contentType === 'application/xml') {
      readXML(doc, {}, function (ok, body, xhr) {
        check(ok, body, xhr ? xhr.status : undefined)
        console.log('Loaded XML ' + targetDocument)
        doNext(remaining)
      }) // target, kb, base, contentType, callback
    } else {
      fetcher.nowOrWhenFetched(doc, {}, function (ok, body, xhr) {
        check(ok, body, xhr ? xhr.status : undefined)
        console.log('Loaded  ' + doc)
        doNext(remaining)
      }) // target, kb, base, contentType, callback
    }
  }
  // Writes the data we have in the store under targetDocument out to file doc
  var writeDocument = function (targetDocument, doc) {
    console.log('  writing ... ' + doc)
    try {
      var outText = $rdf.serialize(targetDocument, kb, targetDocument.uri, contentType)
    } catch (e) {
      exitMessage('Error in serializer: ' + e)
    }
    if (doc.uri.slice(0, 8) !== 'file:///') {
      exitMessage('Can only write files just now, sorry: ' + doc.uri)
    }
    var fileName = doc.uri.slice(7) //
    fs.writeFile(fileName, outText, function (err) {
      if (err) {
        exitMessage('Error writing file ' + doc + ' :' + err)
      }
      console.log('Written ' + doc)
      doNext(remaining)
    })
  }

  while (remaining.length) {
    let arg = remaining.shift()
    let command = arg.split('=')
    let left = command[0]
    let right = command[1]

    if (left.slice(0, 1) !== '-') {
      loadDocument(arg)
      return
    }
    let doc
    switch (left) {
      case '-base':
        base = $rdf.uri.join(right, base)
        break

      case '-clear':
        kb = $rdf.graph()
        break

      case '-dump':
        console.log('Serialize ' + targetDocument + ' as ' + contentType)
        try {
          var out = $rdf.serialize(targetDocument, kb, targetDocument.uri, contentType)
        } catch (e) {
          exitMessage('Error in serializer: ' + e)
        }
        console.log('Result: ' + out)
        break

      case '-format':
        contentType = right
        break

      case '-report':
        reportDocument = $rdf.sym($rdf.uri.join(right, base))
        break

      case '-validate':
        if (!targetDocument) {
          console.log('Load data to be validated before -validate=shapefile')
          process.exit(1)
        }
        let shapeDoc = $rdf.sym($rdf.uri.join(right, base))
        console.log('shapeDoc ' + shapeDoc)
        fetcher.nowOrWhenFetched(shapeDoc, {}, function (ok, body, xhr) {
          if (!ok) {
            exitMessage("Error loading " + doc + ": " + body)
          } else {
            console.log("Loaded shape file " + shapeDoc)
            let checker = new ShapeChecker(kb, shapeDoc, targetDocument, reportDocument)
            checker.execute()
            console.log('Validation done.')
            targetDocument = reportDocument
            writeDocument(reportDocument, reportDocument) // and move on to next command
          }
        })
        return

      case '-help':
        console.log(helpMessage)
        break

      case '-in':
        loadDocument(right)
        return

      case '-out':
        doc = $rdf.sym($rdf.uri.join(right, base))
        writeDocument(targetDocument, doc)
        return

      case '-spray':
        var root = $rdf.sym($rdf.uri.join(right, base)) // go back to folder
        if (root.uri.slice(0, 8) !== 'file:///') {
          exitMessage('Can only write files just now, sorry: ' + doc.uri)
        }
        try {
          spray(root.uri, targetDocument)
        } catch (e) {
          exitMessage('Error in spray: ' + e)
        }
        return

      case '-size':
        console.log(kb.statements.length + ' triples')
        doNext(remaining)
        break

      case '-test':
        doc = $rdf.sym($rdf.uri.join(right, base))
        console.log("Loading " + doc)
        fetcher.nowOrWhenFetched(doc, {}, function(ok, message){
          if (!ok) exitMessage("Error loading tests " + doc + ": " + message)
          runTests(doc).then(function(issues){
            console.log("DONE ALL TESTS. Issue array length: " + issues.length)
            issues.forEach(function(issue){
              console.log('  Test: ' + issue.test)
            })
            doNext(remaining)
          })
        })
        return

      case '-version':
        console.log('rdflib built: ' + $rdf.buildTime)
        break

      default:
        console.log('Unknown command: ' + left)
        console.log(helpMessage)
        process.exit(1)
    }
  }
/*
  (function wait () {
     if (true) setTimeout(wait, 3000);
  })();
*/
  process.exit(0)    // No!!! node must wait for stuff to finish
}

var statementsToTurtle = function (kb, statements, base) {
  var sz = new $rdf.Serializer(kb)
  sz.suggestNamespaces(kb.namespaces)
  sz.setBase(base)
  sz.setFlags('si') // Suppress = for sameAs and => for implies
  return sz.statementsToN3(statements)
}

// Returns a promise of an issues list
var validationTest = function(test){
  const indent = '     '
  var forwardTree = function (x) {
    var sts = []
    var f = function (x) {
      var s = kb.statementsMatching(x)
      sts = sts.concat(s)
      s.forEach(function (st) {
        if (st.object.termType === 'BlankNode') {
          f(st.object)
        }
      })
    }
    f(x)
    return sts
  }
  console.log(indent + 'Validation test ' + test)
  action = kb.the(test, mf('action'))
  if (!action) throw new Error("Need action")
  dataGraph = kb.the(action, sht('dataGraph'))
  shapesGraph = kb.the(action, sht('shapesGraph')) // A doc
  actualGraph = kb.sym(test.uri + '__results')
  if (!dataGraph || !shapesGraph || !actualGraph) throw new Error("Need all params")
  let opts = { noResultMessage: true } // must be excludded from tests
  ;(new ShapeChecker(kb, shapesGraph, dataGraph, actualGraph, opts)).execute()

  expected = kb.the(test, mf('result')) // Node
  var expectedDoc = kb.statementsMatching(expected)[0].graph // whare is that data anyway?
  var base  = expected.doc? expected.doc().uri : dataGraph.uri
  let expectedStatements = forwardTree(expected)
  console.log(indent + 'Expected statements: ' + expectedStatements.length)
  let expectedString = statementsToTurtle(kb, expectedStatements, expectedDoc.uri)
  let actualStatements = kb.statementsMatching(null, null, null, actualGraph)
  console.log(indent + 'Actual statements: ' + actualStatements.length)
  let actualString = statementsToTurtle(kb, actualStatements, actualGraph.uri)
  let issues = []
  if (expectedString === actualString) {
    console.log(indent + '      Match -> passed')
  } else {
    console.log(indent + '    -> FAILED, expected:')
    let ul = '\n__________________________________________________\n'
    console.log(ul + expectedString + ul + actualString + ul)
    issues.push({ test, expectedString, actualString, // generic
       dataGraph, shapesGraph, actualGraph}) // test type specific
  }
  return Promise.resolve(issues)
}
registerTest(sht('Validate'), validationTest)

// Returns promise of issues array
var doAppropriateTest = function (test){
  return new Promise(function(resolve, reject){
    console.log('  -- Do approp test for ' + test)
    var testDoc
    if (test.uri.includes('#')){
      testDoc = test.doc()
    } else {
      if (test.uri.endsWith('.ttl')) {
        testDoc = test
      } else {
        testDoc = kb.sym(test.uri + '.ttl') /// needed for shacl tests in file space
      }
    }
    console.log( "loading... " + testDoc)
    fetcher.load(testDoc).then(function (xhr) {
      var klasses = kb.each(test, a)
      var ppp = []
      for (let j=0; j<klasses.length; j++){
        let handler = testHandlers[klasses[j].uri]
        if (handler){
          handler(test).then(function (issues) {
            resolve(issues)
          })
          break
        }
        resolve(null)
      }
    })
    .catch(function (e) {
      const message = "Error in doAppropriateTest loading " + testDoc + ': ' + e
      console.log(message)
      console.log('stack: ' + e.stack.toString())
      reject(new Error(message))
    })
  }) // promise
}

// See https://www.w3.org/TR/rdf11-testcases/
// Returns a promise of set of issues
var runTests = function (doc) {
  const indent = ''
  console.log("runTests " + doc)
  return new Promise(function(resolve, reject){
    kb.fetcher.load(doc).then(function (xhr) {
      console.log(indent + 'Manifest loaded: ' + doc)
      let comment = kb.anyValue(doc, kb.sym('http://www.w3.org/2000/01/rdf-schema#comment'))
      if (comment) console.log(indent + comment)
      var action, dataGraph, shapesGraph, expected, actualGraph
      var testList = kb.any(doc, mf('entries'))
      let promises = []
      if (testList) {
        testList = testList.elements
        console.log("Entries " + testList.length)
        promises = testList.map(doAppropriateTest)
      }
      let includes = kb.each(doc, mf('include'))
      console.log(indent + ' includes: ' + includes.length + ' for ' + doc )
      promises = promises.concat(includes.map(runTests))
      Promise.all(promises).then(function(issues){
        console.log('Done with ' + doc + ': ' + issues ? issues.length : "ISSUES ERROR @@@")
        resolve(issues) // @@ mayeb have to concat subarrays
      })
      .catch(function (e) {
        const message = "ERROR in runTests loading " + doc + ': ' + e
        console.log(message)
        console.log('stack: ' + e.strack.toString())
        reject(new Error(message))
      })
    })
  })
}

// Store linked data in separe files
//
//  Caution: use with care!  This will build a complete linked data
// database of linked files from master data

var spray = function (rootURI, original, doubleLinked) {
  var docs = []
  console.log('Spray: Root is ' + rootURI)
  var docURI
  var check = function (x) {
    // console.log('check x= ' + x)
    if (x.uri && x.uri.startsWith(rootURI)) {
      var docURI = x.uri.split('#')[0]
      if (docURI === original.uri) {
        // console.log('     (ignoring original file) ' + docURI)
        return
      }
      docs[docURI] = docs[docURI] || []
      if (!docs[docURI][x.uri]) console.log('target ' + x)
      docs[docURI][x.uri] = true
    }
  }
  kb.statements.forEach(function (st) { check(st.subject); check(st.object) }) // Not predicates

  for (docURI in docs) {
    var sts = []
    console.log('Document: ' + docURI)
    for (var uri in docs[docURI]) {
      var thing = $rdf.sym(uri)
      console.log('  Thing: ' + thing)

      var connected = kb.connectedStatements(thing)
      console.log('    We have ' + connected.length + ' statements around ' + thing)
      sts = sts.concat(connected)
    }
    console.log('We have ' + sts.length + ' total statements in document ' + docURI)
    var fileName = docURI.slice(7)  + '.ttl'
    var out = statementsToTurtle(kb, sts, docURI)

    console.log('To be written to ' + fileName + ':\n' + out + '\n')

    var foo = function (fileName, out){
      var f = fileName
      fs.writeFile(f, out, function (err) {
        if (err) {
          exitMessage("***** Error writing file <" + f + "> :" + err)
        }
        console.log("Written ok: " + f)
      })
    }

    foo(fileName, out)

  }
}

//    Read An XML file
//
//   Contains namespace-trigged specials for  IANA registry data
//
var readXML = function (targetDocument, options, callback) {
  var uri = targetDocument.uri
  var file = $rdf.Util.uri.refTo(base, uri)
  var ignore = { 7: true }

  fs.readFile(file, options.encoding || 'utf8', function (err, data) {
    var defaultNamespace = null
    if (err) {
      console.log('File read FAIL, error: ' + err)
      return callback(false, err)
    }
    console.log('File read ok, length: ' + data.length)
    var local = $rdf.uri.join(file, base) + '#'
    var ns = options.ns || local
    var DOMParser = require('xmldom').DOMParser
    var doc = new DOMParser().parseFromString(data)
    var root = kb.sym(uri)
    var nextId = 0

    var justTextContent = function (ele) {
      var ch = ele.childNodes
      var text = ''
      if (ch) {
        for (let i = 0; i < ch.length; i++) {
          if (ch[i].nodeType !== 3) {
            if (ch.length > 1 && options.iana && ch[i].nodeType === 1 && ch[i].nodeName === 'xref') {
              text += ' ' + ch[i].getAttribute('data') + ' '
            } else {
              return false
            }
          } else {
            text += ch[i].nodeValue
          }
        }
      }

      if (ele.attributes && ele.attributes.length > 0) {
        return false
      }
      if (!options.noTrim) {
        text = text.trim()
      }
      return text
    }

    var randomNamedNode = function(){
      return kb.sym(root.uri + '#n' + (nextId++))
    }

    // ///////////////////////// GPX SPECIAL

    var GPX_predicateMap = {
      time: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#time',
      type: 'http://www.w3.org/2001/XMLSchema#dateTime' },

      lat: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#lat' },
      lon: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#long' },
      ele: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#altitude' }
    }

    // ///////////////////////// IANA SPECIAL

    var IANA_predicateMap = {
      created: { uri: 'http://purl.org/dc/terms/created',
          type: 'http://www.w3.org/2001/XMLSchema#date' }, // @@CHECK
      date: { uri: 'http://purl.org/dc/terms/date',
          type: 'http://www.w3.org/2001/XMLSchema#date' }, // @@CHECK
      description: { uri: 'http://purl.org/dc/terms/description' }, // @@CHECK
      title: { uri: 'http://purl.org/dc/terms/title' },
      value: { uri: 'http://www.w3.org/2000/01/rdf-schema#label' },
      note: { uri: 'http://www.w3.org/2000/01/rdf-schema#comment' }
    }
/*
    var magicIANAxref_Original = function (ele, local) {
      var ch = ele.childNodes
      if (ch.length === 1 && ch[0].nodeName === 'xref') {
        var at = ch[0].attributes
        var ty = at.getNamedItem('type').nodeValue
        var data = at.getNamedItem('data').nodeValue
        if (ty === 'uri') return kb.sym(data)
        if (ty === 'rfc') return kb.sym('https://tools.ietf.org/html/' + data)
        if (ty === 'draft') return kb.sym('https://tools.ietf.org/html/' + data)
        if (ty === 'person') return kb.sym($rdf.uri.join('../person/', local) + data + '#')

        // RFCs are at e.g.  https://tools.ietf.org/html/rfc5005
        // Internet Drafts are at e.g.
        // https://tools.ietf.org/html/draft-ietf-httpbis-legally-restricted-status-04
      }
      return null
    }
*/
    var magicIANAxref = function (ele, local) {
      if (ele.nodeName !== 'xref') return null
      var at = ele.attributes

      var ty = at.getNamedItem('type').nodeValue
      if (ty === 'text') return $rdf.lit(justTextContent(ele)) // eg   "ISO JTC-1"

      var data = at.getNamedItem('data').nodeValue
      if (ty === 'uri') return kb.sym(data)
      if (ty === 'rfc') return kb.sym('https://tools.ietf.org/html/' + data)
      if (ty === 'draft') return kb.sym('https://tools.ietf.org/html/' + data)
      if (ty === 'person') return kb.sym($rdf.uri.join('../person/', local) + data + '#')

      // RFCs are at e.g.  https://tools.ietf.org/html/rfc5005
      // Internet Drafts are at e.g.
      // https://tools.ietf.org/html/draft-ietf-httpbis-legally-restricted-status-04

      return null
    }

    var magicIANAsubject = function (ele, local) {
      var ch = ele.childNodes
      for (let i = 0; i < ch.length; i++) {
        if (ch[i].nodeName === 'value') { // a value subelement gives a local URI
          var localid = justTextContent(ch[i])
          return kb.sym(local + localid)
        }
      }
      /*  Data looks like:
            <record date="2016-08-12">
              <name>vnd.ascii-art</name>
              <xref type="person" data="Kim_Scarborough"/>
              <file type="template">text/vnd.ascii-art</file>
            </record>
            */
      for (let i = 0; i < ch.length; i++) {
        var child = ch[i]
        if (child.nodeName === 'file' && child.attributes && child.getAttribute('type')) {
          return kb.sym($rdf.uri.join(child.textContent, local) + '#Resource')
        }
      }
          /* Data looks like:
          <record>
            <name>rfc822</name>
            <xref type="rfc" data="rfc2045"/>
            <xref type="rfc" data="rfc2046"/>
          </record>
          */
      let parent = ele.parentNode
      // console.log('@@ 3 magicIANAsubject tag: ' + ele.tagName + ' parent: ' + parent.tagName )
      if (ele.tagName === 'record' && parent.tagName === 'registry') {
        for (let i = 0; i < ch.length; i++) {
          var child = ch[i]
          if (child.nodeName === 'name') {
            return kb.sym($rdf.uri.join(parent.getAttribute('id') + '/' + child.textContent, local) + '#Resource')
          }
        }
      }
      return null
    }

    // ////////////////////////////////

    var convert = function (ele, subject, indent) {
      indent = indent || ''
      var pred, obj, type
      // console.log(indent + "nodeName: " + ele.nodeName + " type " + ele.nodeType)
      console.log(indent + 'tagName: ' + ele.tagName)
      if (ele.nodeType in ignore) { // PI
        return
      }

      var setPred = function (id) {
        pred = kb.sym(ns + id)
        if (options.predicateMap && options.predicateMap[id]) {
          var p = options.predicateMap[id]
          // console.log(indent + "Mapping to " + p.uri)
          if (p.uri) {
            pred = kb.sym(p.uri)
          }
          if (p.type) {
            type = kb.sym(p.type)
          }
        }
      }

      if (ele.attributes) {
        var attrs = ele.attributes
        var atr
        // console.log(indent + 'attributes: ' + attrs.length)
        for (var j = 0; j < attrs.length; j++) {
          atr = attrs.item(j)
          // console.log(indent + j + ") " +atr.nodeName + " = " + atr.nodeValue)
          if (atr.nodeName === 'xmlns') {
            defaultNamespace = atr.nodeValue

            if (defaultNamespace === 'http://www.iana.org/assignments') {
              options.iana = true
              ns = 'https://www.w3.org/ns/assignments/reg#'
              options.predicateMap = IANA_predicateMap
              console.log('IANA MODE')
            } else if (defaultNamespace === 'http://www.topografix.com/GPX/1/1') {
              ns = 'http://hackdiary.com/ns/gps#' // @@@ u
              options.predicateMap = GPX_predicateMap
              console.log('GPX Mode')
            }
            continue
          }
          setPred(atr.nodeName)
          kb.add(subject, pred, $rdf.lit(atr.nodeValue, undefined, type), targetDocument)
        }
      }
      if (ele.childNodes) {
        // console.log(indent + "children " +ele.childNodes.length)
        for (var i = 0; i < ele.childNodes.length; i++) {
          // console.log(indent + '  i ' + i)
          var child = ele.childNodes[i]
          type = null
          setPred(child.nodeName)
          if (child.nodeType === 3) { // text
            obj = child.nodeValue.trim() // @@ optional
            if (obj.length !== 0) {
              // console.log($rdf.lit(obj, undefined, type))
              kb.add(subject, kb.sym(ns + ele.nodeName), $rdf.lit(obj, undefined, type), targetDocument)
            // console.log(indent + 'actual text ' + obj)
            } else {
              // console.log(indent + 'whitespace')
            }
          } else if (!(child.nodeType in ignore)) {
            console.log(indent + '-> ' + child.tagName)
            var txt = justTextContent(child)
            if (txt !== false) {
              if (txt.length > 0) {
                kb.add(subject, pred, $rdf.lit(txt, undefined, type), targetDocument)
              }
            } else if (options.iana && magicIANAxref(child, local)) {
              kb.add(subject, kb.sym(ns + child.nodeName), magicIANAxref(child, local), targetDocument)
              console.log(indent + 'Magic IANA xref ' + child.nodeName + ': ' + magicIANAxref(child, local))
            } else {
              if (child.attributes && child.getAttribute('id')) {
                if (options.iana && child.nodeName === 'person') {
                  let who = child.getAttribute('id')
                  if (!who) throw new Error("Person has no ID")
                  obj = kb.sym($rdf.uri.join('../person/', local) + who + '#')
                  console.log(indent + 'Person is ' + obj)
                } else {
                  let who = child.getAttribute('id')
                  if (!who) throw new Error("Thing has no ID")
                  obj = kb.sym(local + child.getAttribute('id'))
                  console.log(indent + 'Local thing is ' + obj)
                }
              } else if (options.iana && magicIANAsubject(child, local)) {
                obj = magicIANAsubject(child, local)
                console.log(indent + 'Magic IANA URI ' + obj)
              // kb.add(obj, RDF('type'), RDF('Property') , targetDocument)
              } else {
                if (options.iana && child.nodeName === 'uri'){
                  obj = kb.sym(justTextContent(child))
                } else if (options.iana && child.nodeName === 'people') {
                  obj = randomNamedNode()
                } else {
                  obj = kb.bnode()
                }
              }
              kb.add(subject, pred, obj, targetDocument)
              convert(child, obj, indent + '    ')
            }
          }
        }
      }
    }
    convert(doc, root)
    callback(true)
  })
}

doNext(process.argv.slice(2))

// ends
