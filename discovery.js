/*
var PORT = 1982;
var HOST = '239.255.255.250';
var dgram = require('dgram');
var client = dgram.createSocket('udp4');

client.on('listening', function () {
    var address = client.address();
    console.log('UDP Client listening on ' + address.address + ":" + address.port);
    client.setBroadcast(true)
    client.setMulticastTTL(128); 
    client.addMembership('239.255.255.250');
});

client.on('message', function (message, remote) {   
    console.log('A: Epic Command Received. Preparing Relay.');
    console.log('B: From: ' + remote.address + ':' + remote.port +' - ' + message);
});

//client.bind(PORT, HOST);
client.bind(PORT);
*/



/*
var PORT = 33333;
var HOST = '127.0.0.1';

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

server.on('message', function (message, remote) {
    console.log(remote.address + ':' + remote.port +' - ' + message);

});

//server.bind(PORT, HOST);
server.bind(PORT);

let msg = `M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1982
MAN: "ssdp:discover"
ST: wifi_bulb`;

var message = new Buffer(msg);

setInterval(function()
{
    server.send(message, 0, message.length, "1982", "239.255.255.250", function(err, bytes) {
        if (err) throw err;
        console.log('UDP message sent');
        //server.close();
    });
},1000);
*/




//https://gist.github.com/ciaranj/9056285
//http://stackoverflow.com/questions/14130560/nodejs-udp-multicast-how-to

/*
let msg = `M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1982
MAN: "ssdp:discover"
ST: wifi_bulb`;

  var PORT = 1982 ;
  var dgram = require('dgram');
  var client = dgram.createSocket('udp4');

  var server = dgram.createSocket("udp4"); 
  server.bind( function()
  {
    server.setBroadcast(true)
    //server.setMulticastTTL(128);
    setInterval(broadcastNew, 3000);

    var listenPort = server.address().port;
    console.log("listenPort: "+listenPort);

    server.on('error', function onSocketError(err) {
      console.log(err);
    })

    server.on('listening', function () {
        console.log('UDP Client listening');
    });

    server.on('message', function (message, remote) {   
        console.log('================');
        console.log('From: ' + remote.address + ':' + remote.port);
        console.log(""+message);
    });
  });
  
  
  
  function broadcastNew() {
      var message = new Buffer(msg);
      server.send(message, 0, message.length, PORT, "239.255.255.250");
      //server.send(message, 0, message.length, PORT, "192.168.69.56");
      console.log(" --> sending..");
      console.log(""+message);
  }

*/








  /*
  client.on('listening', function () {
      var address = client.address();
      console.log('UDP Client listening on ' + address.address + ":" + address.port);
      client.setBroadcast(true)
      client.setMulticastTTL(128); 
      client.addMembership('239.255.255.250');
  });
  
  client.on('message', function (message, remote) {   
      console.log('================');
      console.log('From: ' + remote.address + ':' + remote.port);
      console.log(""+message);
  });
  
  client.bind(PORT);
  */


var dgram = require('dgram');

/*
let msg = `M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1982
MAN: "ssdp:discover"
ST: wifi_bulb`;
*/

let msg = 'M-SEARCH * HTTP/1.1\nHOST: 239.255.255.250:1982\nMAN: "ssdp:discover"\nST: wifi_bulb';

var message = new Buffer(msg);


var client = dgram.createSocket("udp4");
//client.setBroadcast(true);


client.on('listening', function () {
    var address = client.address();
    console.log('UDP Client listening on ' + address.address + ":" + address.port);
    client.setBroadcast(true);

    console.log("sending...");
    client.send(message, 0, message.length, 12345, "239.255.255.250");
});

client.on('message', function (message, rinfo) {
    console.log('Message from: ' + rinfo.address + ':' + rinfo.port +' - ' + message);
});

client.bind(12345);
//client.send(message, 0, message.length, 1982, "239.255.255.250");