/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var multer = require('multer');
var logger = require('morgan');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var expressBrowserify = require('express-browserify');
var context = require('./utils/context');
var routes = require('./routes');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
// var cfenv = require('cfenv');
require('dotenv').config();

// create a new express server
var app = express();

var upload = multer({dest:'../tmp/'});

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
//app.use(express.bodyParser({uploadDir:'../tmp'}));

// get the app environment from Cloud Foundry
// var appEnv = cfenv.getAppEnv();
// ミドルウェアを設定する。
app.set('views', context.path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(bodyParser.json());

app.get('/', routes.index);
app.post('/upload', upload.single('imagefile'), routes.upload);
app.post('/callback', routes.callback);
app.get('/callback', routes.callback);

// start server on the specified port and binding host
app.listen(process.env.port || 3000, '0.0.0.0', function() {
  // print a message when the server starts listening
  // console.log("server starting on " + appEnv.url);
});
