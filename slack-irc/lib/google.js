var logger = require('winston');
var pup = require("puppeteer");
var url = require("url");
var logger = require("winston");
var jsdom = require("jsdom");

async function handleSearching(r, text, page)
{		
	await page.goto("https://www.google.co.uk");

	try
	{
		const searchBoxSelector = "#lst-ib";
		await page.waitForSelector(searchBoxSelector);
		await page.type(searchBoxSelector, text);
	}
	catch(err)
	{
		r.text = "Timeout trying to enter search query";
		r.error = err;
		return;
	}
	
	try
	{
		logger.error("Pre-click page: " + page.url());

		//const buttonSelector = "#tsf .tsf-p input";
		//await page.waitForSelector(buttonSelector);
		//await page.click(buttonSelector);
		
		await page.keyboard.press("Enter");
	}

	catch(err)
	{
		r.text = "Timeout trying to click on search button";
		r.error = err;
		return;
	}

	const searchResults = ".srg > .g";

	try
	{
		await page.waitForSelector(searchResults);
		logger.error("Post-search page: " + page.url());
	}
	catch(err)
	{
		r.text = "Timeout trying to load results page";
		r.error = err;
		return;
	}

	try
	{
		await page.exposeFunction("parseResult", ahtml =>  {
			var dom = new jsdom.JSDOM(ahtml);

			const elem = dom.window.document.querySelector(".r a");
			const link = url.parse(elem.getAttribute("href")).href;
			return link + " | " + elem.innerHTML;
		});

		r.text = await page.evaluate(async searchResults => {
			const anchors = Array.from(document.querySelectorAll(searchResults));
			
			if (!anchors[0])
			{
				// No results
				return "No results";
			}

			return await window.parseResult(anchors[0].outerHTML);
		}, searchResults);
	}

	catch(err)
	{
		r.text = "Timeout trying to parse results";
		r.error = err;
		return;
	}
}

function handleGoogle(r, text, callback)
{
	if(!text) return;

	r.icon = "https://dl.dropboxusercontent.com/u/314911/img/glogo.png";
	r.command = "Google";
	r.text = "Google says maybe.";
	
	(async() => {
		const browser = await pup.launch();
		const page = await browser.newPage();
	
		await handleSearching(r, text, page);
		callback(r);

		await browser.close();
	})();
}

module.exports = {
	"name": "google",
	"author": "MadrMan",
	"commands": {
		"g": handleGoogle
	}
};
