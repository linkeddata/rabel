echo from-file
mkdir -p from-file/ && (cd from-file/ && ../../rabel.js -in=../named-resources/observation-example-bloodpressure.ttl -spray=http://hl7.org/fhir/)

echo from-http
mkdir -p from-http/ && (cd from-http/ && ../../rabel.js -in=http://build.fhir.org/observation-example.ttl -spray=http://hl7.org/fhir/)

echo doing stats
find named-resources/observation-example-bloodpressure.ttl from-file from-http -type f | while read f; do (echo -n "$f - " && stat -c %s $f); done > pwn-FHIR.stats
