var http = require('http');
var fs = require('fs');
var net = require('net');
var url = require('url');

const HTTP_PORT = 8080;
const APORT = 3000;
const BLACKLIST_PATH = 'blocked.txt';
const HTML_PATH = 'index.html';


function handleHttpRequest(request, response) {

  fs.readFile(BLACKLIST_PATH, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }

    if (data.includes(request.headers['host'])) {
      response.writeHead(404);
      response.write("Blocked by proxy");
      response.end();
    } 
    else {
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


// Setup servers
var proxy = http.createServer(handleHttpRequest);

// Handle HTTPS
proxy.on('connect', (request, cltSocket, head) => {
  var srvUrl = url.parse(`http://${request.url}`);

  fs.readFile(BLACKLIST_PATH, 'utf8', function (err,data) {

    if (err) {
      return console.log(err);
    }

    if (data.includes(srvUrl.hostname)) {
      console.log("Blocked");
      cltSocket.write('HTTP/1.1 404 Not Found\r\n' +
                        'Proxy-agent: Node.js-Proxy\r\n' +
                        '\r\n');
      cltSocket.end();
    } else {

      // connect
      var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, () => {
        cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                        'Proxy-agent: Node.js-Proxy\r\n' +
                        '\r\n');
        srvSocket.write(head);
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
      });

    }
  });
});

proxy.listen(HTTP_PORT);

http.createServer(handleAdminRequest).listen(APORT);
