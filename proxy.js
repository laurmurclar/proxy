var http = require('http');
fs = require('fs');

const PPORT = 8080;
const APORT = 3000;
const BLACKLIST_PATH = 'blocked.txt';
const HTML_PATH = 'index.html';


function handleProxyRequest(request, response) {
  console.log("url: " + request.url);
  console.log("host: " + request.headers['host']);
  fs.readFile(BLACKLIST_PATH, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  if (data.includes(request.headers['host'])) {
    response.write("Blocked by proxy");
    response.end();
  } else {
    var proxy_request = http.request({
      hostname: request.headers['host'],
      method: request.method, 
      path: request.url, 
      headers: request.headers 
    });
    proxy_request.addListener('response', function (proxy_response) {
      proxy_response.addListener('data', function(chunk) {
        response.write(chunk, 'binary');
      });
      proxy_response.addListener('end', function() {
        response.end();
      });
      response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });
    request.addListener('data', function(chunk) {
      proxy_request.write(chunk, 'binary');
    });
    request.addListener('end', function() {
      proxy_request.end();
    });
    }
  });
}

function handleAdminRequest(request, response) {
  fs.readFile(HTML_PATH, 'utf8', function (err,data) {
    if (err) {
      response.writeHead(404);
      response.write("404 - Not found");
      console.log(err);
    } 
    else {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': data.length });
      response.write(data);
    }
    response.end();
  });
}

http.createServer(handleProxyRequest).listen(PPORT);

http.createServer(handleAdminRequest).listen(APORT);
