export default [
    {
        bot: "discord",
        token: "<token>",
        guilds: [
            {
                // My Cool Guild
                id: "<numeric id>",
                channels: [{
                    id: "lobby",
                    discord: "general"
                }, {
                    id: "gamedev",
                    discord: "gamedev"
                }, {
                    id: "playgame",
                    discord: "playgame"
                }]
            }
        ]
    },
    {
        // DevhatNet
        bot: "slack",
        token: "<token>",
        channels: [{ 
            id: "lobby",
            slack: "lobby"
        }, { 
            id: "gamedev",
            slack: "gamedev"
        }, { 
            id: "playgame",
            slack: "playgmae"
        }]
    }
]