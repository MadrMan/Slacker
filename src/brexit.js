function countdown(r, _, callback)
{
	var currentDeadline = new Date("December 31, 2020 23:00:00 (GMT)").getTime();
	var currentPM = "Rishi Sunak";

	var now = new Date().getTime();
	var distance = currentDeadline - now;

	var days = Math.floor(distance / (1000 * 60 * 60 * 24));
	var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

	r.command = "Brexit";
	r.text = `:flag_gb: :flag_eu: What rock have you been living under? Current PM is ${currentPM}.`;
	r.icon = "https://cdn4.iconfinder.com/data/icons/dooffy_design_flags/512/dooffy_design_icons_EU_flags_United_Kingdom.png";
	callback(r);
}

export default {
	"name": "Brexit",
	"author": "ElGoorf",
	"commands": {
		"brexit" : countdown
	}
};
