const Discord = require("discord.js");
const config = require("./config.json");

const bot = new Discord.Client();

const fs = require('fs');

var mysql = require('mysql');

var FilePath = "";

var FileName = 'logs/Console';
var DateOffset = 3; //לשנות לפי שעון חורף או שעון קיץ

var con = mysql.createConnection({
  host: config.sql_host,
  user: config.sql_user,
  password: config.sql_password,
  database: config.sql_database
});

con.connect(function(err) 
{
	if (err)throw err;
	con.query("CREATE TABLE IF NOT EXISTS `discord_players_data` (`steam_id` VARCHAR(128) NOT NULL, `discord_id` VARCHAR(128) NOT NULL, `name` VARCHAR(128) NOT NULL, UNIQUE(`steam_id`), UNIQUE(`discord_id`))", function (err) 
	{
	  if (err) throw err;
	});
	con.query("CREATE TABLE IF NOT EXISTS `discord_gamestats_messages` (`channel` VARCHAR(128) NOT NULL, `message_id` VARCHAR(128) NOT NULL, UNIQUE(`channel`))", function (err) 
	{
		if (err) throw err;
	});
});

bot.on('ready', () => {
	bot.user.setActivity('Play-IL PickUps', { type: 'LISTENING' });
});


bot.on("message", function(message) 
{ 
	if(message.channel.type === "dm")return;
	var args = new Array();
	args = message.content.split(' ');
	if(message.channel == config.pickup_webhook_channel || message.channel == config.test_webhook_channel)
	{
		message.delete();
		if(!message.author.bot)
		{
			if(args[0] == "!sendinfo")
			{
				var author = message.author;
				if(args.length < 5)
				{
					author.send(`Usage: !sendinfo <channel> <ip+port> <password>\nExample: \`\`\`!sendinfo #game-report 185.185.134.236:10012 12\`\`\`\n||${author}||`);
					return;
				}
				var channel = message.mentions.channels.first();
				SendInfoMessage(channel, args[2], args[3]);
				author.send(`${author}, I sent the message to channel ${channel}`);
				SendLog(`${author.tag} send info to channel "${channel.name}"`);
			}
			return;
		}
		const opretion = args[0];
		switch(opretion)
		{
			case 'move':
			{
				if(args.length < 3)
				{
					return;
				}
				
				const member = bot.users.cache.find(user => user.id === args[1]);
				let channel = bot.channels.cache.get(args[2]);
				const guildmember = message.guild.member(member);
				if(guildmember != null && guildmember.voice.channel != null)
				{
					guildmember.voice.setChannel(channel);
					SendLog(`Moved ${member.tag} to channel "${channel.name}"`);
				}
				break;
			}
			case 'verify':
			{
				if(args.length < 3)
				{
					return;
				}
				
				const steamid = args[1];
				const member = bot.users.cache.find(user => user.tag === args[2]);
				
				if(member == undefined)
				{
					return;
				}
				
  				con.query("INSERT INTO `discord_players_data` (`steam_id`, `discord_id`, `name`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `discord_id` = VALUES(`discord_id`), `name` = VALUES(`name`)",[steamid, member.id, member.tag], function (err, result) 
				{
    				if (err) throw err;
					SendLog(`Verified ${member.tag} with "${steamid}"`);
 				});
				break;
			}
			case 'gamestats':
			{
				if(args.length < 4)
				{
					return;
				}

				const channel = bot.channels.cache.get(args[1]);
				var server = args[2];
				const Embed = new Discord.MessageEmbed()
				.setColor("#FF9900")
				.setTitle(config.BOT_TITLE)
				.setImage("https://i.imgur.com/5xUxzed.png")
				.addField("__Server:__", `**${server.replaceAll('%20', ' ')}**`, false)
				if(args.length == 4)
				{
					var status = args[3];
					Embed.addField("__Currently:__", `**${status.replaceAll('%20', ' ')}**`, false);
				} else if(args.length == 7) {
					var lobby = args[3];
					Embed.addField("__Lobby:__", `**${lobby.replaceAll('%20', ' ')}**`, false)
					.addField("__Map:__", `**${args[4]}**`, false)
					.addField("__Team A:__", `**${args[5]}**`, true)
					.addField("__Team B:__", `**${args[6]}**`, true);
				} else{
					return;
				}

				Embed.setFooter(`Play-IL - It's all about the game.`, "https://i.imgur.com/p0SALds.png");
				
				con.query("SELECT `message_id` FROM `discord_gamestats_messages` WHERE `channel` = ?", channel.id, function (err, result, fields) 
				{
					if (err) throw err;
					if(result.length > 0)
					{
						var msg_id = result[0].message_id;
						channel.messages.fetch(msg_id)
						.then(message =>
						{
							message.edit(Embed);
							SendLog(`Edited message "${message.id}" in channel "${channel.name}" to newer game stats`);
						});
					} else{
						channel.send(Embed)
						.then((message) => 
						{
							SendLog(`Sent new game stats message. Id: "${message.id}', Channel: "${channel.name}"`);
							con.query("INSERT INTO `discord_gamestats_messages` (`channel`, `message_id`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `message_id` = VALUES(`message_id`)",[channel.id, message.id], function (err, result) {
								if (err) throw err;
							});
						});
					}
				});
				break;
			}
		}
		return;
	}
});

bot.login(config.BOT_TOKEN);

function SendLog(message)
{
	const currentData = new Date();	
    var utcDate = currentData.getTime() + (currentData.getTimezoneOffset() * 60000);
    var israelDate = new Date(utcDate + (3600000 * DateOffset));
	
	var log = "L "+ israelDate.getMonth() + "/" + israelDate.getDate() + "/" + israelDate.getFullYear() + " - " + israelDate.getHours() + ":" + israelDate.getMinutes() + ":" + israelDate.getSeconds() + " : " + message;
	
	console.log(log);
	
	if (FilePath == "")
	{
		FilePath = FileName + "_" + israelDate.getFullYear() + israelDate.getMonth() + israelDate.getDate() + ".log";
	} 

	if(fs.existsSync(FilePath))
	{
		log = "\n"+log;
	}
	fs.appendFileSync(FilePath, log);
}

function SendInfoMessage(channel, ip, server_password)
{
	var message = `:IP לכניסה לשרת העתיקו את כתובת ה\n\`\`\`connect ${ip}; password ${server_password}\`\`\``;
	message = message + `\n:לכניסה מהירה לשרת לחצו על הקישור למטה\nsteam://connect/${ip}/${server_password}\n \n**!!!כל השחקנים מחויבים לשחק עם משתמש פריים**`;
	channel.send(message);
} 