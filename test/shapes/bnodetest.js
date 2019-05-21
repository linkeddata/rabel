
const $rdf = require('rdflib')

const kb = $rdf.graph()
const fetcher = $rdf.fetcher(kb)

const sh = $rdf.Namespace('http://www.w3.org/ns/shacl#')

const here = 'file:///devel/github.com/linkeddata/rabel/test/shapes/'

const doc = $rdf.sym(here + 'nodeKind-001.ttl')


const ex0 = $rdf.Namespace(doc.uri + '#')
const ex = $rdf.Namespace('http://datashapes.org/sh/tests/core/property/nodeKind-001.test#')
const log = console.log

fetcher.load(doc).then(function(xhr){
  log("loaded")
  let shape = ex('ShapeWithBlankNode')
  log('shape: ' + shape)
  let property = kb.the(shape, sh('property'))
  log('property: ' + property)
  let path = kb.the(property, sh('path'))
  log('path: ' + path)
  process.exit(0)
})
