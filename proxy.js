var http = require('http');
var fs = require('fs');
var net = require('net');
var url = require('url');
var qs = require('querystring');
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ host: 'localhost', port: 8000 });


const HTTP_PORT = 8080;
const APORT = 3000;
const WSPORT = 8000;
const BLACKLIST_PATH = 'blocked.txt';
const HTML_PATH = 'index.html';


wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    client.send(data);
  });
};

wss.on('connection', function(ws) {
  console.log("connection");
});

function handleHttpRequest(request, response) {

  // Send url and method to admin console
  var data = request.method + " " + request.url;
  wss.broadcast(data);
  // open file
  fs.readFile(BLACKLIST_PATH, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }

    // Check if request blacklisted
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

  if (request.method == "GET"){
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
  else if (request.method == "POST") {
    var body = '';

    request.on('data', function (data) {
      body += data;

      // Too much POST data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6)
          request.connection.destroy();
    });

    request.on('end', function () {
      var post = qs.parse(body);
      console.log(post.site);
      fs.appendFile(BLACKLIST_PATH, post.site + "\n", 'utf8', (err) => {
        if (err) throw err;
        console.log('It\'s saved!');
      });
    });

    response.write("Hello");
    response.end();
  } 
  else {
    console.log("err: " + request.method);
    response.end();
  }
  
}


// Setup servers
var proxy = http.createServer(handleHttpRequest);

// Handle HTTPS
proxy.on('connect', (request, cltSocket, head) => {
  var srvUrl = url.parse(`http://${request.url}`);

  // Send to admin console
  var data = request.method + " " + request.url;
  wss.broadcast(data);

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
