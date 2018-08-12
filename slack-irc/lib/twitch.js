var http = require('http');
var https = require('https');
var logger = require('winston');
var apikeys = require('./apikeys');

twitchOnlineStreams =[];
// twitchUserList = [ "madflux", "tuireanntv", "thothonegan" ];
twitchUserList = [ "moggie100", "tuireanntv", "thothonegan" ];

function makeTwitchOptions(url)
{
	var options = {
		host: 'api.twitch.tv',
		port: 443,
		path: url,
		method: 'GET',
		headers: {
			'Client-ID': apikeys.twitchClientID
		}
	}

	return options;
}

function prettyPrintTwitch(r, userLogin, userDisplay, stream)
{
	var streamUrl = "https://twitch.tv/" + userLogin;
	var announce = userDisplay + " is now streaming!";
	r.text = announce + " [ " + streamUrl + " ]";

	r.attachment = {
		"fallback" : r.text,
		"title" : announce,
		"title_link" : streamUrl,
		"image_url": stream.thumbnail_url.replace("{width}", "512").replace("{height}", "288"),
		"text": stream.title,
		"color": "#6441A5"
		//"fields": 
		//[
		//	{
		// 		"title" : "Viewers",
		//		"value" : stream.viewer_count,
		//		"short" : false
		//	}
		//]
	};
}

function printTwitchUpdateForStream(r, data, callback)
{
	var options = makeTwitchOptions("/helix/users?id=" + data.user_id);
	https.get(options, function(res) {
		var body = '';
		res.on('data', (data) => body += data);
		// res.on('error', (e) => console.error(e));
		res.on('end', () => {
			var apires = JSON.parse(body);
			logger.error(apires);

			if (res.statusCode == 200) {
				prettyPrintTwitch(r, apires.data[0].login, apires.data[0].display_name, data);
				callback(r);
			} else {
				// Something blew up
			}
		});
	});
}

function twitchOnlineCheck(r, text, callback)
{
	r.icon = "https://vignette3.wikia.nocookie.net/logopedia/images/8/83/Twitch_icon.svg/revision/latest?cb=20140727180700";

	var isManualCheck = (text != null);
	var usersToCheck;
	if (isManualCheck) {
		usersToCheck = [ text ];
	} else {
		usersToCheck = twitchUserList;
	}

	var url = "/helix/streams?";
	usersToCheck.forEach(function(user) {
		url += "&user_login=" + user;
	});

	https.get(makeTwitchOptions(url), function(res) {	
		var body = '';
		res.on('data', (data) => body += data);
		// res.on('error', (e) => console.error(e));
		res.on('end', () => {
			var apires = JSON.parse(body);
			logger.error(res.statusCode);
			logger.error(apires);
			if (res.statusCode == 200) {
				if (apires.data.length == 0 && isManualCheck) {
					r.text = usersToCheck[0] + " is offline";
					callback(r);
				} else {
					var currentOnlineStreams = [];

					apires.data.forEach(function(stream)  {
						currentOnlineStreams.push(stream.id);

						if (!twitchOnlineStreams.includes(stream.id))
						{
							// New stream, show update
							printTwitchUpdateForStream(r, stream, callback);
						}
					});

					twitchOnlineStreams = currentOnlineStreams;	
				}
			} else {
				// Something blew up
			}
		});
	});
}

function initializeIntervals(callback)
{
	logger.debug("Setting up twitch intervals...");

	setInterval(function() {
		twitchOnlineCheck(makeR("twitch"), null, function(r) {
			callback(r, "#lobby");
		});
	}, 60 * 1000);
}

module.exports = {
	"name": "twitch.tv",
	"author": "MadrMan",
	"commands": {
		"twitch" : twitchOnlineCheck
	},
	"initializeIntervals": initializeIntervals
};
