var MathParse = require('expr-eval').Parser;

function handleCalc(r, text, callback) 
{
	if(!text) return;

	try {
		var expr = MathParse.parse(text);
		r.text = expr.toString() + " = " + expr.evaluate({});
	} catch(err) {
		r.text = text + " = [" + err + "]";
	}

	r.command = "Calc";
	r.icon = "https://i.vimeocdn.com/portrait/9922894_300x300";
	callback(r);
}

module.exports = {
	"name": "calculator",
	"author": "MadrMan",
	"commands": {
		"calc" : handleCalc
	}
};