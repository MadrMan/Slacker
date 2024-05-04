import https from 'https';
import logger from './logging.js';
import apikeys from './apikeys.js';

const twitchOnlineStreams =[];
// const twitchUserList = [ "madflux", "tuireanntv", "thothonegan" ];
const twitchUserList = [ "moggie100", "tuireanntv", "thothonegan" ];

function loginTwitchAnd(resolve, reject)
{
	var httpHeaders = {
		'client_id': apikeys.twitchClientID,
		'client_secret': apikeys.twitchClientSecret,
		'grant_type': 'client_credentials',
		'scope': 'user:read:email'
	};

	logger.error(JSON.stringify(httpHeaders));

	https.get({
		host: 'id.twitch.tv',
		port: 443,
		path: '/oauth2/token',
		method: 'POST',
		headers: httpHeaders
	}, function(res) {
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () => {
			var apires = JSON.parse(body);
			logger.error(apires);


			if (res.statusCode == 200) {
				logger.error("Twitch login success");
				resolve(apires.access_token);
			} else {
				// Failed to log in
				reject("Twitch login failed");
			}
		});
	});
}

function makeTwitchOptions(url, token)
{
	var options = {
		host: 'api.twitch.tv',
		port: 443,
		path: url,
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + token,
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

async function printTwitchUpdateForStream(r, data)
{
	await new Promise((resolve, reject) => {
		loginTwitchAnd(token => {
			var options = makeTwitchOptions("/helix/users?id=" + data.user_id, token);
			https.get(options, function(res) {
				var body = '';
				res.on('data', (data) => body += data);
				// res.on('error', (e) => console.error(e));
				res.on('end', () => {
					var apires = JSON.parse(body);
					logger.error(apires);
		
					if (res.statusCode == 200) {
						prettyPrintTwitch(r, apires.data[0].login, apires.data[0].display_name, data);
						resolve();
					} else {
						// Something blew up
						reject("Twitch user fetch failed");
					}
				});
			});
		}, reject);
	});
}

async function twitchOnlineCheck(r, text)
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

	await new Promise(resolve => {
		loginTwitchAnd(token => { 
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
							resolve();
						} else {
							var currentOnlineStreams = [];
		
							apires.data.forEach(function(stream)  {
								currentOnlineStreams.push(stream.id);
		
								if (!twitchOnlineStreams.includes(stream.id))
								{
									// New stream, show update
									// TODO: This only shows the first one due to the promise resolve
									printTwitchUpdateForStream(r, stream, callback).then(() => resolve());
								}
							});
		
							twitchOnlineStreams = currentOnlineStreams;	
						}
					} else {
						// Something blew upi
						reject("Twitch user stream check failed");
					}
				});
			});
		}, reject);
	});
}

function initializeIntervals(callback)
{
	logger.debug("Setting up twitch intervals...");

	setInterval(async () => {
		const r = makeR("twitch");
		await twitchOnlineCheck(r, null);
		await callback(r, "#lobby");
	}, 60 * 1000);
}

export default {
	"name": "twitch.tv",
	"author": "MadrMan",
	"commands": {
		"twitch" : twitchOnlineCheck
	},
	"initializeIntervals": initializeIntervals
};
