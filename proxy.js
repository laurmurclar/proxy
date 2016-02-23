var http = require('http');
fs = require('fs');

const PORT = 8080;

function handleRequest(request, response) {
  console.log("url: " + request.url);
  console.log("host: " + request.headers['host']);
  fs.readFile('blocked.txt', 'utf8', function (err,data) {
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

http.createServer(handleRequest).listen(PORT);
