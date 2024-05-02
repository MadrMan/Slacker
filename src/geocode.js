import fetch from 'node-fetch';
import apikeys from './apikeys.js';
import logger from'./logging.js';

async function resolveGeocode(address)
{
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&api_key=${apikeys.mapsdotco}`;
    logger.error(url);

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.length  < 1) {
        throw "Location unknown";
    }

    const first = data[0]; // First hit has the highest importance, so ignore the rest

    return {
        name: first.display_name,
        lat: first.lat,
        lon: first.lon
    };
}

async function handleGeocode(r, text, callback)
{
	if (!text) return;
	text = text.trim();

	r.icon = "https://cdn-icons-png.freepik.com/512/616/616616.png?ga=GA1.1.1424404556.1714663049";

    try
    {
        const location = await resolveGeocode(text);
        r.text = `Location: ${location.name}\nLatitude: ${location.lat}\nLongitude: ${location.lon}`;
    } catch(ex) {
        r.text = ex.toString();
    }

    await callback(r);
}

export default {
	"name": "geocode",
	"author": "MadrMan",
	"commands": {
		"geocode": handleGeocode
	},
    resolveGeocode
};
