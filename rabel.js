#!/usr/local/bin/node
// Utility Data conversion program.
//
// Test platform for parsers and serializers
//
//

var helpMessage =
"Utilty data converter for linked data\n\
\n\
Commands in unix option form are executed left to right, and include:\n\
\n\
-base=rrrr    Set the current base URI (relative URI)\n\
-clear        Clear the current store\n\
-dump         Serialize the current store in current content type\n\
-format=cccc  Set the current content-type\n\
-help         This message \n\
-in=uri       Load a web resource or file\n\
-out=filename Output in eth current content type\n\
-size         Give the current store\n\
-version      Give the version of this program\n\
\n\
Formats are given as MIME types, such as text/turtle (default), application/rdf+xml, etc\n\
\n"


$rdf = require('rdflib');
var fs = require('fs');

var kb = $rdf.graph();
var fetcher = $rdf.fetcher(kb);

var contentType = 'text/turtle';
var base = 'file://' + process.cwd() + '/'
var uri;
var targetDocument;

var check = function(ok, message, status) {
    if (!ok) {
        console.log("Failed " + status + ": " + message);
        process.exit(2);
    }
}

var exitMessage = function(message) {
    console.log(message);
    process.exit(4);
}

var doNext = function(remaining) {

    var loadResource = function(right) {
        targetDocument = $rdf.sym($rdf.uri.join(right, base))
        //console.log("Document is " + targetDocument)
        if (contentType == 'application/xml') {
            readXML(targetDocument,  {}, function(ok, body, xhr) {
                check(ok, body, xhr? xhr.status : undefined);
                console.log("Loaded XML " + targetDocument);
                doNext(remaining);
            }); // target, kb, base, contentType, callback
        } else {
            fetcher.nowOrWhenFetched(targetDocument,  {}, function(ok, body, xhr) {
                check(ok, body, xhr? xhr.status : undefined);
                console.log("Loaded  " + targetDocument);
                doNext(remaining);
            }); // target, kb, base, contentType, callback
        }
    }


    while (remaining.length) {
        // console.log("... remaining " + remaining.join(' '));

        var command = remaining.shift().split('=');
        var left = command[0],
            right = command[1];
        if (left.slice(0,1) !== '-') {
            loadResource(left);
            return;
        }
        switch(left) {
            case '-base':
                base = $rdf.uri.join(right, base)
                break;
                
            case '-clear':
                kb = $rdf.graph();
                break;
                
            case '-dump':
                console.log("Serialize " + targetDocument + " as " + contentType);
                try {
                    var out = $rdf.serialize(targetDocument, kb, targetDocument.uri, contentType);
                } catch(e) {
                    exitMessage("Error in serializer: " + e);
                }
                console.log("Result: " +out);
                break;

            case '-format':
                contentType = right;
                break;
                
            case '-help':
                console.log(helpMessage);
                break;
                
            case '-in':
                loadResource(right);
                return;

            case '-out':
                doc = $rdf.sym($rdf.uri.join(right, base));
                try {
                    var out = $rdf.serialize(targetDocument, kb, targetDocument.uri, contentType);
                } catch(e) {
                    exitMessage("Error in serializer: " + e);
                }
                if (doc.uri.slice(0, 8) !== 'file:///' ) {
                    exitMessage("Can only write files just now, sorry: " + doc.uri);
                }
                var fileName = doc.uri.slice(7); //
                fs.writeFile(fileName, out, function (err) {
                    if (err) {
                        exitMessage("Error writing file <"+right+"> :" + err);
                    }
                    console.log("Written " + doc);
                    doNext(remaining);
                });
                return;
            
            case '-size':
                console.log(kb.statements.length + ' triples');
                break;
        
            case '-version':
                console.log("rdflib built: " + $rdf.buildTime);
                break;
        
            default:
                console.log("Unknown command: " + left);
                console.log(helpMessage);
                process.exit(1);
        }
    }
    process.exit(0);
}

//    Read An XML file
//
//   Contains namespace-trigged specials for  IANA registry data
//
readXML = function(targetDocument, options, callback) {
    var uri = targetDocument.uri
    var file =  $rdf.Util.uri.refTo(base, uri);
    var ignore = { 7: true};
    var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    var RDFS = $rdf.Namespace('http://www.w3.org/2000/01/rdf-schema#');
    
    fs.readFile(file, options.encoding || 'utf8', function(err,data){
        var defaultNamespace = null;
        if (err) {
            console.log("File read FAIL, error: " + err);
            return callback(false, err);
        }
        console.log("File read ok, length: " + data.length);
        var local = $rdf.uri.join(file, base) + '#'
        var ns = options.ns || local
        var DOMParser = require('xmldom').DOMParser;
        var doc = new DOMParser().parseFromString(data);
        var root = kb.sym(uri);

        var justTextContent = function(ele) {
            var ch = ele.childNodes;
            var text = '';
            if (ch) for (var i=0; i< ch.length; i++) {
                if (ch[i].nodeType !== 3) {
                    if (ch.length > 1 && options.iana && ch[i].nodeType === 1 && ch[i].nodeName === 'xref') {
                        text += ' ' + ch[i].attributes.getNamedItem('data').nodeValue + ' ';
                    } else {
                        return false;
                    }
                } else {
                    text += ch[i].nodeValue;
                }
            }

            if (ele.attributes && ele.attributes.length > 0) {
                return false;
            }
            if (!options.noTrim) {
                text = text.trim();
            }
            return text;
        }

        /////////////////////////// GPX SPECIAL
        
        
        var GPX_predicateMap = {
            time: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#time',
            type: 'http://www.w3.org/2001/XMLSchema#dateTime'},
            
            lat: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#lat'},
            lon: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#long'},
            ele: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#altitude'}
        };
        
        
        
        /////////////////////////// IANA SPECIAL
        
        var IANA_predicateMap = {
            created: { uri: 'http://purl.org/dc/terms/created',
                    type: 'http://www.w3.org/2001/XMLSchema#date'}, // @@CHECK
            date: { uri: 'http://purl.org/dc/terms/date',
                    type: 'http://www.w3.org/2001/XMLSchema#date'}, // @@CHECK
            description: { uri: 'http://purl.org/dc/terms/description'}, // @@CHECK
            value: { uri: 'http://www.w3.org/2000/01/rdf-schema#label'},
            note:{ uri: 'http://www.w3.org/2000/01/rdf-schema#comment'}
        };
        var magicIANAxref = function(ele) {
            var ch = ele.childNodes;
            if (ch.length === 1 && ch[0].nodeName === 'xref') {
                var at = ch[0].attributes;
                var ty = at.getNamedItem('type').nodeValue;
                var data = at.getNamedItem('data').nodeValue;
                if (ty === 'uri') return kb.sym(data);
                if (ty === 'rfc') return kb.sym('https://tools.ietf.org/html/' + data);
                if (ty === 'draft') return kb.sym('https://tools.ietf.org/html/' + data);
                
            // RFCs are at e.g.  https://tools.ietf.org/html/rfc5005
            // Internet Drafts are at e.g.
            // https://tools.ietf.org/html/draft-ietf-httpbis-legally-restricted-status-04
            
            }
            return null;
        }

        var magicIANAvalue = function(ele) {
            var ch = ele.childNodes;
            for (var i=0; i < ch.length; i++) {
                if (ch[i].nodeName === 'value') { // a value subelement gives a local URI
                    var localid = justTextContent(ch[i]);
                    return kb.sym(local + localid);
                }
            }
            return null;
        }
        
        //////////////////////////////////

        var convert = function(ele, node, indent) {
            indent = indent || '';
            var pred, obj, type;
            //console.log(indent + "nodeName: " + ele.nodeName + " type " + ele.nodeType)
            //console.log(indent + "tagName: " + ele.tagName);
            if (ele.nodeType in ignore) { // PI
                return;
            }
            
            var setPred = function(id) {
                pred = kb.sym(ns + id);
                if (options.predicateMap && options.predicateMap[id]) {
                    var p = options.predicateMap[id];
                    // console.log(indent + "Mapping to " + p.uri)
                    if (p.uri) {
                        pred = kb.sym(p.uri);
                    }
                    if (p.type) {
                        type = kb.sym(p.type);
                    }
                }
            }
                
            if (ele.attributes) {
                var attrs = ele.attributes, a;
                // console.log(indent + 'attributes: ' + attrs.length)
                for (var j=0; j < attrs.length; j++) {
                    a = attrs.item(j);
                    // console.log(indent + j + ") " +a.nodeName + " = " + a.nodeValue);
                    if (a.nodeName === 'xmlns') {
                        defaultNamespace = a.nodeValue;
                
                        if (defaultNamespace  == 'http://www.iana.org/assignments') {
                            options.iana = true;
                            ns = 'https://www.w3.org/ns/assignments/reg#';
                            options.predicateMap = IANA_predicateMap;
                            console.log('IANA MODE');
                
                        } else if (defaultNamespace === 'http://www.topografix.com/GPX/1/1') {
                            ns ='http://hackdiary.com/ns/gps#'; // @@@ u
                            options.predicateMap = GPX_predicateMap;
                            console.log('GPX Mode');
                        }
                        continue;
                    }
                    setPred(a.nodeName);
                    kb.add(node, pred, $rdf.lit(a.nodeValue, undefined, type), targetDocument);
                }
            }
            if (ele.childNodes) {
                // console.log(indent + "children " +ele.childNodes.length)
                for(var i=0; i<ele.childNodes.length; i++) {
                    // console.log(indent + '  i ' + i)
                    var child = ele.childNodes[i];
                    type = null;
                    setPred(child.nodeName);
                    if (child.nodeType === 3) { // text
                        //throw "We should not see text nodes at this level"
                        // console.log(indent + "  nodeName: " + child.nodeName + " type " + child.nodeType)
                        obj = child.nodeValue.trim(); // @@ optional
                        if (obj.length !== 0) {
                            console.log($rdf.lit(obj, undefined, type))
                            kb.add(node, kb.sym(ns + ele.nodeName), $rdf.lit(obj, undefined, type), targetDocument)
                            // console.log(indent + 'actual text ' + obj)
                        } else {
                            // console.log(indent + 'whitespace')
                        }
                    } else if (!(child.nodeType in ignore)){
                        var txt = justTextContent(child);
                        if (txt !== false) {
                            if (txt.length > 0) {
                                kb.add(node, pred, $rdf.lit(txt, undefined, type), targetDocument)
                                // console.log($rdf.lit(txt, undefined, type))
                            }
                        } else if (options.iana && magicIANAxref(child)) {
                            kb.add(node, kb.sym(ns + child.nodeName), magicIANAxref(child), targetDocument);
                            // console.log(indent + "Magic IANA xref " + magicIANAxref(child))
                        } else {
                            if (child.attributes && child.attributes.getNamedItem('id')){
                                obj = kb.sym(local + child.attributes.getNamedItem('id').nodeValue);
                            } else if (options.iana && magicIANAvalue(child)) {
                                obj = magicIANAvalue(child);
                                // console.log(indent + "Magic IANA value " + obj)
                                kb.add(obj, RDF('type'), RDF('Property') , targetDocument);
                            } else {
                                obj = kb.bnode();
                            }
                            kb.add(node, pred, obj, targetDocument);
                            convert(child, obj, indent + '    ');
                        }
                    }
               }
            }
        }
        convert(doc, root);
        callback(true);
    });

}

doNext(process.argv.slice(2));


 // {'forceContentType': 'application/rdfa'}

// http://melvincarvalho.com/
// http://schema.org/Person
