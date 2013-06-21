var http = require('http');
var fs = require('fs');
var spawn 	= require('child_process').spawn;
var express	= require('express');

var app = express();

var moduleDirectory = 'public/modules'

app
.use(express.compress())
.use(express.static('public'))
.use(express.bodyParser());

var walkDir = function(dir, done) {
	var _this = this;
	var results = [];
	fs.readdir(dir, function(err, list) {
	
		if(err) {
			return done(err);
		}
		
		var pending = list.length;
		if(!pending) {
			return done(null, results);
		}
		
		//  Sort alpha, asc
		//
		list.sort(function(a, b) {
			return a < b ? -1 : 1;
		}).forEach(function(file) {
		
			file = dir + '/' + file;
			fs.stat(file, function(err, stat) {
				if(stat && stat.isDirectory()) {
					walkDir(file, function(err, res) {
						results = results.concat(res);
						if(!--pending) {
							done(null, results);
						}
					});
				} else {
					results.push(file);
					if(!--pending) {
						done(null, results);
					}
				}
			});
		});
	});
};


//////////////////////////////////////////////////////////////////////////////////
//																				//
//										Modules									//
//																				//
//////////////////////////////////////////////////////////////////////////////////

//	Set up file watchers, which will handle file changes -- reminify, flag
//	module rebuild, and so on. Modules can be changed live, with clients being
//	notified of these changes.
//
walkDir(moduleDirectory, function(err, list) {

	if(err) {
		throw "Module directory cannot be read. You should terminate the server.";
	}
	
	//	Will store basic last-modified info about files.
	//
	var fileModifyHistory = [];

	list.forEach(function(file) {

		//	Do not watch `module` files or `.min.` files
		//
		if(file.indexOf(".min.") !== -1 || file.lastIndexOf("module") === (file.length - 6)) {
			return;
		}
		
		fs.watch(file, {
			persistent : false
		}, function(event, filename) {
			
			var now 	= process.uptime();
			var last 	= fileModifyHistory[file];
			var min		= file.replace(/\.(.+)$/, function(seg) { 
				return ".min" + seg 
			});

			if(event !== "change") {
				return;
			}			
			
			if(!last) {
				fileModifyHistory[file] = now - 2;
			}

			//	A ~two second buffer before reacting to changes on a file, mainly 
			//	for handling multiple file events.
			//
			//	https://github.com/joyent/node/issues/2126
			//
			if((now - fileModifyHistory[file]) > 2) {

				fileModifyHistory[file] = now;
				
				//	On module dir changes we:
				//	- remove the .min file bound to this changed file
				//	- run a minify pass, then
				//	- remove any existing `module` file. 
				//
				//	This removed module file will be rebuilt on next module 
				//	request (see /module/).
				//
				
				fs.unlink(min, function(err) {
					//	It's ok if the min doesn't exist (ENOENT=34), but other
					//	errors might need to be tracked.
					//
					if(err) {
						if(err.errno !== 34) {
							console.log(err);
							return;
						}
					}
					
					spawn('make', ['minify'])
					.on('close', function(code) {
					
						//	Should be zero(0), maybe do something here
						//	to log any errors.
						//
						if(code !== 0) {
							return;
						}
						
						//	unlink `module` file
						//
						file = file.replace(/\/([^\/]*)$/, '/module');

						fs.unlink(file, function() {
							
							//	Here some notification might be sent to all
							// 	connected clients to update module (hot code swap).
							//
						});
					});
				});
			}		
		});
	});
});

app.get('/module/:name', function(req, res) {

	//	NOTE: slashes cannot be passed directly in a route, so deep modules use backtick(`) as
	//	placeholder for slash when sent. This is transformed for parsing, then re-instated 
	//	below when responding:
	//
	//	Want module `baz` at /modules/foo/bar/baz:
	//	HTML: <module name="foo`bar`baz"></module>
	//	->get->:name->foo:bar:baz->foo/bar/baz
	//	<-{'foo`bar`baz': {css:"...",html:"..." etc}
	//
	var coll 	= req.params.name.replace("`","/");
	var fin		= {};

	if(!coll) {
		return res.error("Malformed request");
	}
	
	coll = coll.split("|");
	
	//	Remove duplicates
	//
	coll = coll.filter(function(item, idx, arr){
        return idx == arr.lastIndexOf(item);
    });
    
	var total = coll.length;
	
	var checkFinal = function() {
		if(!(--total)) {
			res.writeHead(200, {
				"Content-type" : "application/json"
			});
			res.end(JSON.stringify(fin));
		}
	}
	
	coll.forEach(function(name, midx) {
	
		var path 		= moduleDirectory + "/" + name
		var modulepath	= path + "/module";

		//	Check for pre-built module file.
		//
		fs.readFile(path + "/module", function(err, cachedmod) {
		
			//	If no error the cached `module` file can be fetched and returned.
			//
			if(!err) {
				fin[name.replace("/","`")] = JSON.parse(cachedmod);
				return checkFinal();
			}

			//	Run through all files and create an accumulating attribute on a return
			//	object concatenating all files of same type. JS and CSS files demand
			//	a minified version -- non-minified js/css will not be served.
			//
			walkDir(path, function(err, files) {

				//	Silent fail on errors
				//
				if(err || !files) {
					return checkFinal();
				}	

				var mdata 	= {};
				var len 	= files.length;

				files.forEach(function(file) {
	
					var ext = file.substring(file.lastIndexOf(".") +1, Infinity);
	
					//	For non-html files (css; js) we only load minified files.
					//	To minify, return to root and `make minify`
					//
					if( ext !== "html" 
					    &&  file.indexOf(".min." + ext) < 0) {
						--len;
						return;
					}
	
					fs.readFile(file, "utf-8", function(err, cont) {
						if(!err) {
						    mdata[ext] = (mdata[ext] || "") + cont;
						}
	
						if(!(--len)) {
						
							fin[name.replace("/","`")] = mdata;
							
							fs.writeFile(modulepath, JSON.stringify(mdata), function() {
								console.log("writing: " + file);
								checkFinal();
							});
						}
					});
				});
			});
		});
	});
});

http.createServer(app).listen(8080);
