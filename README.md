# rabel - linked data format converter

Program for reading and writing linked data in various formats.

To install,

    npm install -g rabel

## Command line

Commands look like unix options are executed *in order* from left to right. They  include:
```
-base=rrrr    Set the current base URI (relative URI, default is file:///$PWD)
-clear        Clear the current store
-dump         Serialize the current store in current content type
-format=cccc  Set the current content-type
-help         This message
-in=uri       Load a web resource or file
-out=filename Output in the current content type
-report=file  set the report file destination for future validation
-size         Give the current store
-spray=base   Write out linked data to lots of different linked files CAREFUL!
-test=manifest   Run tests as described in the test manifest
-validate=shapeFile   Run a SHACL validator on the data loaded by previous in=x
-version      Give the version of this program
```

Formats cccc are given as MIME types. These can be used for input or output:

 * text/turtle   *(default)*
 * application/rdf+xml

whereas these can only input:

 * application/rdfa
 * application/xml

 #### Examples

```

rabel -format=application/xml -in=foo.xml -format=text/turtle -out=foo.ttl

rabel part*.ttl -out=whole.ttl
```
## Details
Currently rabel can read from the web or files, and write only to files.  Filenames are deemed to be relative URIs just taken relative to file:///{pwd}/ where {pwd} is the  current working directory.

One use case is testing all the parsers. Another is providing a stable serialization. The output serialization is designed to be stable under small changes of the the data, to allow data files to be checked into source code control systems.

The name comes from RDF and Babel.

### XML

When loading XML, elements are mapped to arcs, and text content to trimmed RDF strings. For the XML namespace used for IANA registry documents, custom mapping is done, both of properties and datatypes, and local identifier generation.
(See the source for details!)
