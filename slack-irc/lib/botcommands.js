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

function loadCommandModule( moduleFile )
{
	let module = require( moduleFile );

	for( let k in module.commands ) {
		if( commandList[k] != undefined && commandList[k] != null )
			console.log( `WARN: Module ${module.name} (${moduleFile}) overrides command ${k}!` );
		commandList[k] = module.commands[k];
	}
}
loadCommandModule( './google.js' );
loadCommandModule( './calculator.js' )
loadCommandModule( './dice.js' );
loadCommandModule( './imdb.js' );
loadCommandModule( './twitch.js' );
loadCommandModule( './weather.js' );

commandList.imdb( {}, "The Thing", (r) => { console.log( "Reply:", r ); } );

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

	setInterval(function() {
		// logger.debug("Performing twitch check...");

		twitchOnlineCheck(makeR("twitch"), null, function(r) {
			callback(r, "#lobby");
		});
	}, 60 * 1000);
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
