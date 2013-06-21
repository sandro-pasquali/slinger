#	If you are going to use `make start/stop` this will be the (server) file targeted.
#	If you are proxying (multiple path servers) you may want to change this name (and
#	its corresponding file-name) to achieve unique pid's.
#
NODE_SERVER		= server.js

CSS_FILES		= $(shell find public -not -name "*.min.css" -name '*.css')
JS_FILES		= $(shell find public -not -name "*.min.js" -name '*.js')
CSS_MINIFIED	= $(CSS_FILES:.css=.min.css)
JS_MINIFIED		= $(JS_FILES:.js=.min.js)
MINIFIER		= yuglify
MINIFIER_FLAGS	=

#	This sample test which simply ensures that at least one test exists
#	when we stress our test harness on make.
#
SAMPLE_SPEC = "\
var should 	= require('should');\
var Person = require(__dirname + '/src/dummy-test-to-erase.js');\
describe('Person', function() {\
	it('should say hello', function() {\
		var person 	= new global.pathTesting.Person;\
		person.sayHello('Sandro').should.equal('Hello, Sandro!');\
	});\
});"

SAMPLE_SRC = "global.pathTesting = {};\
global.pathTesting.Person = function() {\
	this.sayHello = function(to) {\
		return 'Hello, ' + to + '!';\
	};\
};"

SAMPLE_SPEC_FILENAME	= "test/dummy-test-to-erase_spec.js"
SAMPLE_SRC_FILENAME		= "test/src/dummy-test-to-erase.js"

%.min.css: %.css
	@$(MINIFIER) $(MINIFIER_FLAGS) $<

%.min.js: %.js
	@$(MINIFIER) $(MINIFIER_FLAGS) $<

all: stop check-dependencies update

update: update-git update-npm minify-clean minify test closer

update-git:
	@echo "******************************************************************************"
	@echo "UPDATING SUBMODULES"
	@echo "******************************************************************************"

	@git submodule update --init --recursive
	@git submodule foreach git pull origin master

update-npm:
	@echo "******************************************************************************"
	@echo "UPDATING NPM and installing yuglify, forever"
	@echo "******************************************************************************"

	@npm update
	@npm install forever -g
	@npm install yuglify -g

minify: minify-css minify-js

minify-css: $(CSS_FILES) $(CSS_MINIFIED)

minify-js: $(JS_FILES) $(JS_MINIFIED)

#	Removes all .min js/css files.
#
minify-clean:
	rm -f $(CSS_MINIFIED) $(JS_MINIFIED)

#	Cleans up npm, minified files. 
#
clean: minify-clean
	rm -rf node_modules

#	@see https://github.com/nodejitsu/forever
#
start:
	@forever start -a -l $(CURDIR)/logs/server.log $(NODE_SERVER)
	@echo "** Started"

start-devel:
	@forever start -w --watchDirectory public -a -l $(CURDIR)/logs/server.log $(NODE_SERVER)
	@echo "** Started in Development Mode (file watching)"

stop:
	@-forever stop $(NODE_SERVER)
	@echo "** Stopped"
	
help:
	@echo '>make    - Builds the system. 
	@echo
	@echo '>make clean - Wipes npm modules and minified files. You probably do not need this.
	@echo
	@echo '>make update     - npm modules, re-minifies tree, runs tests.'
	@echo '                   This is safe to run at any time.
	@echo '>make update-git - Only update git submodules.'
	@echo '>make update-npm - Only update npm packages.'
	@echo
	@echo '>make test   - Run tests.'
	@echo
	@echo '>make start       - Run the server as a daemon.'
	@echo '>make start-devel - Same as start, but now any changes made within the /public directory'
	@echo '                    will cause a server restart. Helpful while developing, but likely'
	@echo '                    not in production (ie. restarts destroy all client connections)'
	@echo
	@echo '>make stop   - Stop the server daemon.'
	@echo
	@echo 'Minifying:          
	@echo '>make minify         - Minify all .js AND .css files.'
	@echo '>make minify-css     - Minify all .css files.'
	@echo '>make minify-js      - Minify all .js files.'
	@echo '>make minify-clean   - Removes all .min js/css files.'
	@echo

check-dependencies:
	@bash bin/cmd_check

#	Create a sample test file, and run tests
#
#	A test/ directory should exist in the distribution (containing at least one test).
#	The src/ subdir is not necessarily present, and we'll need it if not.
#
test: 
	@test -d test/src || mkdir test/src

	@echo "Creating a sample SPEC file ($(SAMPLE_SPEC_FILENAME)), for testing."
	@echo $(SAMPLE_SPEC) > $(SAMPLE_SPEC_FILENAME)
	@echo "Creating a sample SRC file ($(SAMPLE_SRC_FILENAME)), for testing."
	@echo $(SAMPLE_SRC)	> $(SAMPLE_SRC_FILENAME)
	@echo "******************************************************************************"
	@echo "RUNNING TESTS"
	@echo "******************************************************************************"

	@export NODE_PATH=.; \
	./node_modules/mocha/bin/mocha \
	--reporter list

closer:
	@echo "******************************************************************************"
	@echo "DONE"
	@echo "******************************************************************************"

.PHONY: clean check-dependencies update update-git update-npm test help start start-devel stop minify minify-css minify-js minify-clean closer