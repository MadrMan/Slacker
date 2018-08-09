"use strict";

const logger = require('winston');
const url    = require("url");
const https  = require("https");

const DUCK_API_HOST = "api.duckduckgo.com";
const DUCK_API_PORT = 443;

async function duckQuery( params, callback ) {
	let searchParts = [];
	for( let key in params )
		searchParts.push( encodeURIComponent(key) + "=" + encodeURIComponent(params[key]) );

	const req = https.request( {
		hostname: DUCK_API_HOST,
		port: DUCK_API_PORT,
		path: '/?' +searchParts.join('&'),
		method: 'GET'
	}, (res) => {
		let _buffer = "";
		res.on( 'data', (d) => { _buffer += d.toString(); });
		res.on( 'end', () => callback( null, JSON.parse(_buffer) ) );
	});

	req.on( 'error', (e) => callback( e, null ) );
	req.end();
}

function _question( text, callback ) {
	let composedQuery = text;

	duckQuery( {
		"q": composedQuery,
		"format": "json",
		"no_html": 1
	}, ( err, data ) => {
		let answer = data.AbstractText || "Sorry, I don't know :<";
		let image = data.Image || "";

		callback( err, {
			"text": "Quack! " +answer,
			"icon": image
		} );
	} );
}

async function handleQuery( r, text, callback )
{
	if(!text) return;

	if( text.trim()[[text.length-1]] === '?' ) {
		r.text = "Question?";
		_question( text.trim(), (err, out) => {
			if( err )
				logger.error( err );
			r.icon = out.icon || "https://duckduckgo.com/assets/logo_header.v107.lg.svg"; // URL
			r.command = out.command || "DuckDuckGo";
			r.text = out.text || "Quack?";

			callback(r);
		} );
	}
}

module.exports = {
	"name": "duckduckgo",
	"author": "John Vidler",
	"commands": {
		"duck": handleQuery
	}
};