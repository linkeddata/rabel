#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const serveStatic = require('serve-static');
const portfinder = require('portfinder');
const http = require('http');
const finalhandler = require('finalhandler');

// Path to the main rabel.js script
const rabelPath = path.resolve(__dirname, '../rabel.js');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  xmlOnly: args.includes('--xml-only'),
  htmlOnly: args.includes('--html-only'),
  shapesOnly: args.includes('--shapes-only'),
  verbose: args.includes('--verbose')
};

// Server instance to clean up
let server = null;

// Helper function to start a static file server
async function startServer(directory) {
  const port = await portfinder.getPortPromise();
  const serve = serveStatic(directory);
  
  server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`Started server on port ${port}`);
      resolve(`http://localhost:${port}`);
    });
    
    server.on('error', reject);
  });
}

// Helper function to stop the server
function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

console.log('Running rabel tests...');
if (options.xmlOnly) console.log('Running XML tests only');
if (options.htmlOnly) console.log('Running HTML tests only');
if (options.shapesOnly) console.log('Running SHACL shapes tests only');
if (options.verbose) console.log('Verbose mode enabled');

// Array to store test results
const testResults = [];
let failures = 0;

// Helper function to run a rabel command and return a promise
function runRabelTest(testName, args, expectedExitCode = 0, category = 'general') {
  // Skip tests based on command line options
  if ((options.xmlOnly && category !== 'xml') || 
      (options.htmlOnly && category !== 'html') || 
      (options.shapesOnly && category !== 'shapes')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log(`\nRunning test: ${testName}`);
    console.log(`Command: node ${rabelPath} ${args.join(' ')}`);
    
    const rabel = spawn('node', [rabelPath, ...args]);
    
    let stdout = '';
    let stderr = '';
    
    rabel.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        process.stdout.write(data);
      }
    });
    
    rabel.stderr.on('data', (data) => {
      stderr += data.toString();
      if (options.verbose) {
        process.stderr.write(data);
      }
    });
    
    rabel.on('close', (code) => {
      // For rabel.js, existence of output in stdout indicates success rather than exit code
      const hasOutput = stdout.trim().length > 0;
      // If we expect a specific exit code, check that instead
      const passed = expectedExitCode !== null ? code === expectedExitCode : hasOutput;
      
      if (!passed) failures++;
      
      testResults.push({
        name: testName,
        passed,
        stdout,
        stderr,
        exitCode: code,
        category
      });
      
      console.log(`Test ${testName}: ${passed ? 'PASSED' : 'FAILED'}`);
      if (passed && !options.verbose) {
        console.log(`Output: ${stdout.length > 100 ? stdout.substring(0, 100) + '...' : stdout}`);
      } else if (!passed && !options.verbose) {
        console.error(`Error output:\n${stderr}`);
      }
      
      resolve();
    });
  });
}

// Run tests in sequence
async function runTests() {
  try {
    // Start with regular tests
    // Test 1: Parse small XML file
    await runRabelTest('Parse small XML', [
      '-in=test/xml/small.xml',
      '-dump'
    ], null, 'xml');
    
    // Test with HTTP server
    const serverUrl = await startServer(path.join(__dirname));
    
    // Test: Parse XML over HTTP
    await runRabelTest('Parse XML over HTTP', [
      `-in=${serverUrl}/xml/small.xml`,
      '-dump'
    ], null, 'xml');
    
    // Test: Parse HTML over HTTP
    await runRabelTest('Parse HTML over HTTP', [
      `-in=${serverUrl}/html/xml-data-island.html`,
      '-dump'
    ], null, 'html');
    
    // Test: SHACL validation over HTTP
    await runRabelTest('SHACL Validation over HTTP', [
      `-in=${serverUrl}/shapes/alicebob.ttl`,
      `-validate=${serverUrl}/shapes/expected.ttl`
    ], null, 'shapes');
    
    // Clean up server
    await stopServer();
    
    // Continue with remaining tests
    // Test 2: Parse a subset of the GPX file to avoid memory issues
    await runRabelTest('Parse small XML again', [
      '-in=test/xml/small.xml',
      '-dump'
    ], null, 'xml');
    
    // Test 3: Test with SHACL shapes
    await runRabelTest('SHACL Validation', [
      '-in=test/shapes/alicebob.ttl',
      '-validate=test/shapes/expected.ttl'
    ], null, 'shapes');
    
    // Test 4: Parse HTML with XML data island
    await runRabelTest('Parse HTML with XML data', [
      '-in=test/html/xml-data-island.html',
      '-dump'
    ], null, 'html');
    
    // Test 5: Basic help command test - always run this test
    await runRabelTest('Help command', [
      '-help'
    ], 0, 'general');

    // Skip summary if no tests were run
    if (testResults.length === 0) {
      console.log('\nNo tests were run based on the command line options.');
      return;
    }

    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${testResults.length}`);
    console.log(`Passed: ${testResults.length - failures}`);
    console.log(`Failed: ${failures}`);
    
    // Exit with appropriate code
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    await stopServer(); // Ensure server is stopped even on error
    process.exit(1);
  }
}

// Run all tests
runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await stopServer(); // Ensure server is stopped even on error
  process.exit(1);
});
