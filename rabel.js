
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
    while (remaining.length) {
        // console.log("... remaining " + remaining.join(' '));

        var command = remaining.shift().split('=');
        var left = command[0],
            right = command[1];
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
                condole.log(helpMessage);
                break;
                
            case '-in':
                targetDocument = $rdf.sym($rdf.uri.join(right, base))
                //console.log("Document is " + targetDocument)
                fetcher.nowOrWhenFetched(targetDocument,  {}, function(ok, body, xhr) {
                    check(ok, body, xhr? xhr.status : undefined);
                    console.log("Loaded  " + targetDocument);
                    doNext(remaining);
                }); // target, kb, base, contentType, callback
                return; // STOP processing at this level

            case '-inXML':
                targetDocument = $rdf.sym($rdf.uri.join(right, base))
                //console.log("Document is " + targetDocument)
                readXML(targetDocument.uri,  {}, function(ok, body, xhr) {
                    check(ok, body, xhr? xhr.status : undefined);
                    console.log("Loaded XML " + targetDocument);
                    doNext(remaining);
                }); // target, kb, base, contentType, callback
                return; // STOP processing at this level

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
                    console.log("Written " + fileName);
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
                condole.log(helpMessage);
                process.exit(1);
        }
    }
    process.exit(0);
}

readXML = function(uri, options, callback) {
    var file =  $rdf.Util.uri.refTo(base, uri);
    fs.readFile(file, undefined, function(err,data){
        if (err) return callback(false, err);
        var ns = options.ns || $rdf.uri.join(file, base)
        var DOMParser = require('xmldom').DOMParser;
        var doc = new DOMParser().parseFromString(data);
        var root = kb.bnode();
        kb.add(kb.sum(uri), kb.sym('http://www.w3.org/2007/ont/link#xmlRoot'), root);
        var convert = function(ele, node) {
            if (ele.children) for(var i=0; i<ele.children.length; i++) {
                var child = ele.children[i];
                var node2 = kb.bnode();
                kb.add(node, kb.sym(uri+child.tagName), node2)
                
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
