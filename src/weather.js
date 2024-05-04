import async from 'async';
import http from 'http';
import logger from'./logging.js';
import apikeys from './apikeys.js';
import fetch from 'node-fetch';
import geocode from './geocode.js';

const pollen_icons = {
	"Error":     "http://johnvidler.co.uk/icon/pollen/low.png",
	"Default":   "http://johnvidler.co.uk/icon/pollen/low.png",
	"Low":       "http://johnvidler.co.uk/icon/pollen/low.png",
	"Moderate":  "http://johnvidler.co.uk/icon/pollen/moderate.png",
	"High":      "http://johnvidler.co.uk/icon/pollen/high.png",
	"Very High": "http://johnvidler.co.uk/icon/pollen/very-high.png"
}

async function getWeatherForLatLong(address, lat, lng, extended = false)
{
	var url = "http://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lng + "&APPID=" + apikeys.openweathermapAPIKey;
	logger.error(url);

	const request = await fetch(url);
	const apijson = await request.json();

	var status = apijson.cod;
	if (status != "200")
	{
		throw "OpenWeatherMap ERROR: " + apijson.message;
	}

	let weather = apijson.weather[0];
	let windSpeed = parseFloat(apijson.wind.speed) * 3.6;
	let data = {
		"weather":       weather,
		"wind":          apijson.wind,
		"main":          apijson.main,
		"celsius":       parseFloat(apijson.main.temp) - 273.15,
		"prettyDesc":    weather.description.charAt(0).toUpperCase() + weather.description.slice(1),
		"prettyAddress": address + " | " + apijson.name,
		"windSpeed":     windSpeed,
		"windSpeedMph":  windSpeed * 0.621371192,
		"windDirection": 'Wind',
		"humidity":		 apijson.main.humidity,
		"score":         0        // Dummy value for if we're doing a 'Top Trumps' thing with this data - saves iterating over it later... -John
	};
	
	if (data.windSpeed > 1 && typeof data.wind.deg !== 'undefined')
	{
		let windDirections = [ 'North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest' ];
		let currentQuadrant = Math.round(parseFloat(data.wind.deg) / (360.0 / windDirections.length));
		data.windDirection = windDirections[currentQuadrant % windDirections.length] + ' wind';
	}

	data.text = data.prettyAddress + " | " + data.prettyDesc + ", " + data.celsius.toFixed(1) + '\xB0C (' + (data.celsius * 1.8 + 32).toFixed(1) + '\xB0F) | ' + data.windDirection + ' ' + data.windSpeed.toFixed(1) + ' km/h (' + data.windSpeedMph.toFixed(1) + ' mph)';
	data.icon = 'http://openweathermap.org/img/w/' + weather.icon + '.png';

	if(extended) {
		data.attachment = {
			title: `Weather for ${data.prettyAddress}`,
			fallback: data.text,
			fields: [
				{
					"title": "Conditions",
					"value": data.prettyDesc
				},
				{
					"title": "Temperature",
					"value": `${data.celsius.toFixed(1)}\xB0C (${(data.celsius * 1.8 + 32).toFixed(1)}\xB0F)`
				},
				{
					"title": "Wind",
					"value": `${data.windDirection} ${data.windSpeed.toFixed(1)} km/h ( ${data.windSpeedMph.toFixed(1)} mph)`
				},
				{
					"title": "Humidity",
					"value": `${data.humidity}%`
				}
			]
		};
	}

	return data;
}

async function getWeatherData( location, extended)
{
	const resolved = await geocode.resolveGeocode(location);

	return await getWeatherForLatLong(resolved.name, resolved.lat, resolved.lon, extended );
}

async function handleWeather(r, text, extended = false)
{
	if (!text) return;

	text = text.trim(); // Just in case :/
	let locations = text.split(" vs ");

	// Regular weather lookup
	if( locations.length == 1 ) {
		const data = await getWeatherData(text, extended);
		r.text = data.text;
		r.icon = data.icon;
		r.attachment = data.attachment;

		return;
	}

	// Weather competition!
	if( locations.length > 1 ) {
		let targets = [];

		for( let i=0; i<locations.length; i++ )
			targets.push( locations[i].trim() );

		const results = await Promise.all(targets.map(item => getWeatherData(item, extended)));

		for( let k in results[0] ) {
			if( k == "score" )
				continue;

			let winner = targets[0];

			for( let i=1; i<targets.length; i++ ) {
				let a = parseFloat(targets[i][k], 10);
				let b = parseFloat(winner[k], 10);

				if( !isNaN(a) && !isNaN(b) && a > b )
					winner = targets[i];
			}
			winner.score++;
		}

		let winner = targets[0];
		for( let i=1; i<targets.length; i++ ) {
			if( targets[i].score > winner.score )
				winner = targets[i];
		}

		r.text = `Winner: ${winner.prettyAddress} with ${winner.score} points! (${winner.text})`;
		r.icon = winner.icon;
	}

	r.text = "Eh, what? Need at least one location to get the weather!";
}

async function getPollenLatLng(lat, lng ) {
	lat = lat || '54.0466';
	lng = lng || '2.8007';

	const url = `https://socialpollencount.co.uk/api/forecast?location=[${lat},${lng}]`;
	const today = new Date().toISOString().substr(0,10);

	const request = await fetch(url);
	const data = await request.json();

	for( let i=0; i<data.forecast.length; i++ ) {
		let item = body.forecast[i];
		if (item.date.contains(today)) {
			return item.pollen_count;
		}
	};

	throw "Could not find a pollen forecast for that location";
}

async function handlePollen(r, text)
{
	if (!text) return;
	text = text.trim();
	r.icon = pollen_icons.Default;

	try {
		const resolved = await geocode.resolveGeocode(text);
		const result = await getPollenLatLng(resolved.lat, resolved.lon);

		r.text = `Pollen for ${text} is ${result}`;
		if( pollen_icons[text] )
			r.icon = pollen_icons[text];
	} catch(ex) {
		r.icon = pollen_icons.Error;
		throw ex;
	}
}

export default {
	"name": "weather",
	"author": "MadrMan, John Vidler",
	"commands": {
		"weather": handleWeather,
		"beather": (r, text) => handleWeather(r,text,true),
		"pollen": handlePollen
	}
};
