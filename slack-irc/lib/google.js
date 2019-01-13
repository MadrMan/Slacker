var logger = require('winston');
var pup = require("puppeteer");
var url = require("url");
var logger = require("winston");
var jsdom = require("jsdom");

async function screenshot(page)
{
	const outfile = "/var/www/mmy.mooo.com/public_html/slacker/google.png";
	const httpfile = "http://mmy.mooo.com/slacker/google.png";

	await page.screenshot({
		path: outfile
	});
	logger.error("Written google screenshot to: " + outfile);

	return httpfile;
}

async function handleSearching(r, text, page)
{
	await page.goto("https://www.google.co.uk");

	r.text = "Timeout trying to enter search query";
	const searchBoxSelector = "input[autocomplete=off]";
	await page.waitForSelector(searchBoxSelector);
	await page.type(searchBoxSelector, text);

	logger.error("Pre-click page: " + page.url());
	r.text = "Timeout trying to click on search button";
	await page.keyboard.press("Enter");

	const searchResults = ".srg > .g";
	const captchaDiv = ".g-recaptcha";
	const captchaButton = ".recaptcha-checkbox-checkmark";

	r.text = "Timeout waiting for search";
	await page.waitForSelector([
		searchResults,
		captchaDiv
	].join(', '));

	// Navigation finished, check for captcha
	if (await page.$(captchaDiv) !== null) {
		logger.error("Captcha found");
		r.text = "Hit captcha but frame not found";	

		// Captcha is always inside an iframe
		var captcha = await function(page) {
			let fulfill;
			const promise = new Promise(f => fulfill = f);
			page.once("frameattached", () => fulfill(page.frames()[1]));
			const frame = page.frames()[1];
			if (frame) fulfill(frame);
			return promise;
		}(page);

		// No results found, probably captcha'd
		r.text = "Timeout solving captcha";

		// Captcha hit, solve
		var checkbox = await captcha.waitForSelector(captchaButton);
		logger.error("CHECKBOX: "  + checkbox);
		await checkbox.click();
	
		// Wait for actual results to load up
		r.text = "Failed to solve captcha";
		await page.waitForSelector(searchResults);
		logger.error("Post-captcha page: " + page.url());
	}
	
	r.text = "Timeout trying to parse results";
	await page.exposeFunction("parseResult", ahtml =>  {
		var dom = new jsdom.JSDOM(ahtml);

		const elem = dom.window.document.querySelector(".r a");
		const link = url.parse(elem.getAttribute("href")).href;
		return link + " | " + elem.querySelector("h3").textContent;
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

	return true;
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
		let success = false;

		try
		{
			success = await handleSearching(r, text, page);
		} catch(err) {
			r.error = err + " | " + await screenshot(page);
		}

		logger.error("Result of search: " + r.text + " = success: " + success);

		callback(r);

		if (success) {
			// Forward to stop bot check
			let resultLink = await page.waitForSelector(".r a");
			await resultLink.click();
			await page.waitForNavigation({waitUntil: 'load'});

			// Verify
			await screenshot(page);
		}

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
