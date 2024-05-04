import { Parser } from 'expr-eval';

function handleCalc(r, text) 
{
	if(!text) return;

	try {
		var expr = Parser.parse(text);
		r.text = expr.toString() + " = " + expr.evaluate({});
	} catch(err) {
		r.text = text + " = [" + err + "]";
	}

	r.command = "Calc";
	r.icon = "https://i.vimeocdn.com/portrait/9922894_300x300";
}

export default {
	"name": "calculator",
	"author": "MadrMan",
	"commands": {
		"calc" : handleCalc
	}
};