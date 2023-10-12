const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;


const serverConfig = {
   key: fs.readFileSync('key.pem'),
   cert: fs.readFileSync('cert.pem'),
};

var users = {};
var allUsers = [];


const handleRequest = function(request, response) {
   console.log('request received: ' + request.url);

   if(request.url === '/') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(fs.readFileSync('client/index.html'));
  } else if(request.url === '/webrtc.js') {
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end(fs.readFileSync('client/webrtc.js'));
  }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');


const wss = new WebSocketServer({server: httpsServer});



wss.on('connection', function(ws) {
   ws.on('message', function(message) {

      var data;
      try { 
         data = JSON.parse(message); 
      } catch (e) { 
         console.log("Invalid JSON"); 
         data = {}; 
      }
    
      console.log('received data:', data);
      switch (data.type) { 
         case "login": 
            console.log("User logged", data.name); 
     
            console.log('if anyone is logged in with this username then refuse') 
            if(users[data.name]) { 
               sendTo(ws, { 
                  type: "login", 
                  success: false 
               }); 
            } else { 
               console.log('save user connection on the server') 
               users[data.name] = ws; 
               allUsers.indexOf(data.name) === -1 ? allUsers.push(data.name) : console.log("This item already exists");
               
               ws.name = data.name;
       
               sendTo(ws, { 
                  type: "login", 
                  success: true, 
                  allUsers:allUsers
               }); 
            } 
     
         break;
     
         case "offer": 

            console.log("Sending offer to: ", data.name); 
     
            var conn = users[data.name]; 
     
            if(conn != null) { 

               ws.otherName = data.name; 
       
               sendTo(conn, { 
                  type: "offer", 
                  offer: data.offer, 
                  name: ws.name 
               }); 
            } 
     
         break;
     
         case "answer": 
            console.log("Sending answer to: ", data.name); 

            var conn = users[data.name]; 
            console.log('answer: ',data.answer)
      
            if(conn != null) { 
               ws.otherName = data.name; 
               sendTo(conn, { 
                  type: "answer", 
                  answer: data.answer 
               });
            } 
      
         break;
     
         case "candidate": 
            console.log("Sending candidate to:",data.name); 
            var conn = users[data.name];  
      
            if(conn != null) { 
               sendTo(conn, { 
                  type: "candidate", 
                  candidate: data.candidate 
               }); 
            } 
      
         break;
     
         case "leave": 
            console.log("Disconnecting from", data.name); 
            var conn = users[data.name]; 
            conn.otherName = null; 
      
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave" 
               }); 
            }  
      
         break;
     
         default: 
            sendTo(ws, { 
               type: "error", 
               message: "Command not found: " + data.type 
            });
      
         break; 
      }  
   });

   ws.on("close", function() { 
      if(ws.name) { 
         delete users[ws.name]; 
    
         if(ws.otherName) { 
            console.log("Disconnecting from ", ws.otherName); 
            var conn = users[ws.otherName]; 
            conn.otherName = null;  
         
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave" 
               }); 
            }  
         } 
      } 
   });  

});

function sendTo(connection, message) { 
  connection.send(JSON.stringify(message)); 
}


console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome');
