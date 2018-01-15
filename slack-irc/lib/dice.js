function handleRoll(r, text, callback)
{
	if(!text) return;

	var p = text.split(/[d\-\+]/);
	var dice = p.length > 1 ? parseInt(p[0]) : 1;
	var sides = p.length > 1 ? parseInt(p[1]) : parseInt(p[0]);
	var base = p.length > 2 ? parseInt(p[2]) : 1;
	if(text.indexOf('-') > -1) base *= -1;
	var v = base * dice + Math.floor(Math.random() * dice * (sides - 1));
	
	r.command = "Roll";
	r.text = "You rolled: " + v;
	r.icon = "http://homepage.hispeed.ch/~grrds_games/Dice/images/dice.png";
	callback(r);
}

module.exports = {
	"name": "dice",
	"author": "MadrMan",
	"commands": {
		"roll" : handleRoll
	}
};