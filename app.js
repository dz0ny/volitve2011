
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , api_request = require('api_request')
  , csv = require('csv')
  , zadnja = {}
  , livesedaj = 0

var app = module.exports = express.createServer();
io = require('socket.io').listen(app)
io.configure('production', function(){
  io.set('log level', 0);
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('transports', [
    'websocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

setInterval(osvezi(function(data) {
  io.emit("stanje",data);
  io.emit("live",livesedaj);
  zadnja=data;
}),1000*30)

io.sockets.on('connection', function (socket) {
    livesedaj++;
    socket.emit("stanje",zadnja);
    socket.emit("live",livesedaj);
    socket.broadcast.emit("live",livesedaj);
    socket.on('disconnect', function (disc) {
        livesedaj--;
        socket.broadcast.emit("live",livesedaj);
    });
});


function osvezi(cb) {
  var deloi = {};
  deloi.stranke = [];
  deloi.legenda = [];
  deloi.stanje = [];
  deloi.skupaj = 0;
  var r = new api_request('http', 'www.dvk.gov.si');
  r.get('/volitve/dz2011/rez.csv').on('reply', function(reply, res) {
      csv()
      .from(reply)
      .transform(function(data){
          data.unshift(data.pop());
          return data;
      })
      .on('data',function(data,index){
        if (index>1 && index < (deloi.strank+2) ) {
          deloi.stranke.push({ime: data[0].split(";")[1], glasov:0, sedezev:0})
          deloi.legenda.push("%%.%% " + data[0].split(";")[1])
        };
        if (index>(deloi.strank+2) && index < (deloi.strank+2)*2 ) {
          var rindex = index-(deloi.strank)-3;
          if (rindex< deloi.strank) {
            var stranka = data[1].split(";");
            deloi.stranke[rindex].glasov =Number(stranka[1]);
            deloi.stanje.push(Number(stranka[1]));
            deloi.stranke[rindex].sedezev =Number(stranka[2]);
            deloi.skupaj = deloi.skupaj+Number(stranka[1]);
          };
        };
        if (index ==1) {
          deloi.strank = Number(data[0])
        };
      })
      .on('end',function(count){
          cb(deloi)
      })
      .on('error',function(error){
          console.log(error.message);
      });
  });
}
