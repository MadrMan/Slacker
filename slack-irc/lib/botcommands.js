var http = require('http');
var https = require('https');
var logger = require('winston');
var apikeys = require('./apikeys');

function handleSource(r, text, callback)
{
	r.command = "Source";
	r.text = "https://github.com/MadrMan/Slacker";
	r.icon = "https://assets-cdn.github.com/images/modules/logos_page/Octocat.png";

	callback(r);
}

var commandList = { "source" : handleSource };
var modules = [];

function registerCommandModule( moduleFile )
{
	modules.push(require(moduleFile));
}

function loadCommandModules()
{
	for (let m of modules) {
		for( let k in m.commands ) {
			if( commandList[k] != undefined && commandList[k] != null ) {
				logger.warn( `Module ${m.name} overrides command ${k}!` );
			}
	
			commandList[k] = m.commands[k];
		}
	}

	logger.error("Registered a total of " + modules.length + " modules with " + Object.keys(commandList).length + " commands");
}

registerCommandModule( './google.js' );
registerCommandModule( './calculator.js' )
registerCommandModule( './dice.js' );
registerCommandModule( './imdb.js' );
registerCommandModule( './twitch.js' );
registerCommandModule( './weather.js' );

loadCommandModules();

function makeR(cmd)
{
	var prettyCommand = cmd.charAt(0).toUpperCase() + cmd.slice(1);

	return {
		command: prettyCommand,
		icon: null,
 		text: '<empty>'
	};
}

exports.initializeIntervals = function(callback)
{
	logger.debug("Setting up bot interval-based checks...");

	for (let module in modules) {
		if (module.initializeIntervals) {
			module.initializeIntervals(callback);
		}
	}
}

exports.processUserCommand = function(text, callback)
{
	if(text[0] != '!') return;

	var sep = text.toLowerCase();
	var space = sep.indexOf(' ');
	sep = (space == -1) ? [ sep ] : [ sep.substr(0, space), sep.substr(space + 1) ];
	sep[0] = sep[0].slice(1); // strip '!'

	var r = makeR(sep[0]);
	var handler = commandList[sep[0]];
	if (handler)
	{
		logger.error("Handling command: " + sep[0]);
		handler(r, sep.length > 1 ? sep[1] : null, callback);
	}
}
