const { channel } = require('diagnostics_channel');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// zeabur這段沒用
require('dotenv').config();


process.on('uncaughtException', (err) => {
    console.error('未捕獲的異常:', err);
    fs.appendFileSync('error.log', `[${new Date().toISOString()}] uncaughtException: ${err.stack}\n`);
});

process.on('unhandledRejection', (reason) => {
    console.error('未處理的 Promise 拋出異常:', reason);
    fs.appendFileSync('error.log', `[${new Date().toISOString()}] unhandledRejection: ${reason}\n`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // 必須啟用才能獲取成員資訊
    ]
});

const fs = require('fs');
const path = require('path');

// 錯誤日誌路徑
const logsDir = path.join(__dirname, 'logs');

// 確保 logs 資料夾存在
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
// 記錄錯誤的函數
function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.stack || error}\n`;
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}_errors.log`);

    // 將錯誤訊息追加到日誌檔案中
    fs.appendFile(logFile, logMessage, (err) => {
        if (err) console.error('無法寫入錯誤日誌:', err);
    });
}

function logMessage(name, text) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${name} 說： ${text}`;
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}_message.log`);
    fs.appendFile(logFile, logMessage, (err) => {
        if (err) console.error('無法寫入悄悄話訊息:', err);
    });
}

function logResult() {
    for (let i = 0; i < questionList.length; i++) {
        let string = ''
        const question = questionList[i];
        string += `${playerList[i].name}的題目是：${question.answerList[0]}`
        const maxRounds = isEvenPlayers() ? playerList.length : playerList.length;
        for (let j = 1; j < maxRounds; j++) {
            const answer = question.answerList[j];
            const type = j % 2 === 0 ? '答案' : '提示';
            let index = i + j;
            if (index >= playerList.length) index -= playerList.length;
            const player = playerList[index];
            string += `${player.name}的${type}是：${answer}\n`
        }

        const logMessage = `${new Date().toISOString()} - ${string}\n`; // 每筆記錄加上時間戳
        const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}_result.log`);
        fs.appendFile(logFile, logMessage, (err) => {
            if (err) console.error('無法寫入遊戲結果:', err);
        });
    }
}

function logData(data) {
    const string = JSON.stringify(data);
    const logMessage = `${string}\n`;
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}_data.log`);
    fs.appendFile(logFile, logMessage, (err) => {
        if (err) console.error('無法寫入遊戲結果:', err);
    });
}

// 遊戲狀態
let playerList = [];
let questionList = [];
let turn = 0;
let gameStart = false;
let turnCounter = 0
let isProcessingTurn = false; // 定義一個鎖變數

function isEvenPlayers() {
    return playerList.length % 2 === 0;
}

function isOddTurn() {
    return turn % 2 !== 0;
}

client.on('ready', async () => {
    try {
        console.log(`${client.user.tag} 機器人已上線！`);

        // 創建斜線指令
        const commands = [
            new SlashCommandBuilder()
                .setName('beachef')
                .setDescription('加入遊戲'),

            new SlashCommandBuilder()
                .setName('putonthehat')
                .setDescription('開始遊戲'),

            new SlashCommandBuilder()
                .setName('retire')
                .setDescription('退出遊戲'),

            new SlashCommandBuilder()
                .setName('taste')
                .setDescription('領取題目'),

            new SlashCommandBuilder()
                .setName('cook')
                .setDescription('輸入我的答案')
                .addStringOption(option =>
                    option.setName('題目或答案')
                        .setDescription('你的題目或是答案')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('takethehat')
                .setDescription('取代玩家')
                .addStringOption(option =>
                    option.setName('玩家暱稱')
                        .setDescription('你要取代誰')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('initializegame')
                .setDescription('重置遊戲'),

            new SlashCommandBuilder()
                .setName('whispertoshrimp')
                .setDescription('跟小蝦說悄悄話')
                .addStringOption(option =>
                    option.setName('內容')
                        .setDescription('要說什麼呢')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('checkorder')
                .setDescription('確認順序'),

        ].map(command => command.toJSON());

        // 註冊斜線指令
        const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
        //全域註冊
        // await rest.put(
        //     Routes.applicationCommands(process.env.CLIENT_ID),
        //     { body: commands },
        // );
        // 單一伺服器
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID2),
            { body: commands }
        );
        console.log('斜線指令已成功註冊！');
    } catch (error) {
        console.error('初始化時發生錯誤:', error);
        logError(error, '初始化時發生錯誤');
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;

        switch (commandName) {
            case 'beachef':
                await handleJoinGame(interaction);
                break;
            case 'putonthehat':
                await handleStartGame(interaction);
                break;
            case 'retire':
                await handleQuitGame(interaction);
                break;
            case 'taste':
                await handleGetMyAnswer(interaction);
                break;
            case 'cook':
                await handleSetMyAnswer(interaction);
                break;
            case 'takethehat':
                await handleChangePlayer(interaction);
                break;
            case 'initializegame':
                await handleInitializeGame(interaction)
                break;
            case 'whispertoshrimp':
                await handleWhisperToShrimp(interaction)
                break;
            case 'checkorder':
                await handlePrintPlayerList(interaction)
                break;
        }
    } catch (error) {
        console.error(`處理指令 ${interaction.commandName} 時發生錯誤:`, error);
        logError(error, `處理指令 ${interaction.commandName} 時發生錯誤:`);
        await interaction.reply({
            content: '處理指令時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
});
async function handleQuitGame(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (gameStart) {
            await interaction.editReply({
                content: '遊戲已經開始，無法登出',
                ephemeral: true,
            });
            return;
        }
        const index = playerList.findIndex(player => player.id === interaction.user.id)
        if (index === -1) {
            await interaction.editReply({
                content: '你尚未加入遊戲',
                ephemeral: true,
            });
            return
        }
        const name = playerList[index].name
        playerList = playerList.filter(player => player.id !== interaction.user.id)
        await interaction.editReply({
            content: '退出遊戲',
            ephemeral: true,
        });
        await interaction.channel.send({
            content: `${name}退出了遊戲`,
            ephemeral: false
        });
    } catch (error) {
        console.error('處理退出遊戲時發生錯誤:', error);
        logError(error, '處理退出遊戲時發生錯誤:');
        await interaction.editReply({
            content: '退出遊戲時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}
async function handleChangePlayer(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (!gameStart) {
            await interaction.editReply({
                content: '遊戲尚未開始，請直接加入',
                ephemeral: true,
            });
            return;
        }
        if (playerList.some(item => item.id === interaction.user.id)) {
            await interaction.editReply({
                content: '禁止重複加入遊戲',
                ephemeral: true,
            });
            return;
        }

        const name = interaction.options.getString('玩家暱稱');
        let index = playerList.findIndex(item => item.name === name)
        if (index === -1) {
            await interaction.editReply({
                content: '找不到此玩家，請確認暱稱是否正確',
                ephemeral: true,
            });
            return;
        }
        let player = playerList[index];
        const deadname = player.name;
        player.id = interaction.user.id;
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const nickname = member ? member.nickname : null;
        const displayName = nickname || interaction.user.username; // 如果沒有暱稱，就用使用者名稱
        player.name = displayName;


        let orderText = '';
        for (let i = 0; i < playerList.length; i++) {
            const player = playerList[i];
            orderText += player.name
            if (i !== playerList.length - 1) {
                orderText += '→'
            }
        }
        await interaction.editReply({
            content: '你的人生屬於我',
            ephemeral: true,
        });
        // 回應使用者
        await interaction.channel.send({
            content: `${displayName}取代了${deadname}，本場遊戲順序為${orderText}`,
        });
    } catch (error) {
        console.error('處理更換玩家時發生錯誤:', error);
        logError(error, '處理更換玩家時發生錯誤:');
        await interaction.editReply({
            content: '更換玩家時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}
async function handleJoinGame(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (gameStart) {
            await interaction.editReply({
                content: '遊戲正在進行中，請稍後再試',
                ephemeral: true,
            });
            return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const nickname = member ? member.nickname : null;
        const displayName = nickname || interaction.user.username; // 如果沒有暱稱，就用使用者名稱
        if (playerList.some(item => item.id === interaction.user.id)) {
            await interaction.editReply({
                content: '禁止重複加入遊戲',
                ephemeral: true,
            });
            return;
        }
        playerList.push({ name: displayName, id: interaction.user.id });
        // 建立 Embed 訊息
        const embed = new EmbedBuilder()
            .setColor('00FF66')
            .setTitle('成員名單')
            .setDescription(`目前有${playerList.length}名玩家`);
        for (let i = 0; i < playerList.length; i++) {
            embed.addFields(
                { name: playerList[i].name, value: '\u200B', inline: true }
            );
        }
        embed.setFooter({ text: `快點加入唷`, iconURL: interaction.user.displayAvatarURL() });
        await interaction.editReply({
            content: '加入遊戲',
            ephemeral: true,
        });
        // 回應使用者
        const reply = await interaction.channel.send({
            content: `${displayName} 加入了遊戲：`,
            embeds: [embed],
        });
        await reply.react('738238281271214211');
    } catch (error) {
        console.error('處理加入遊戲時發生錯誤:', error);
        logError(error, '處理加入遊戲時發生錯誤:');
        await interaction.editReply({
            content: '加入遊戲時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}

async function handleStartGame(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (gameStart) {
            await interaction.editReply({
                content: '遊戲正在進行中，請稍後再試',
                ephemeral: true,
            });
            return;
        }
        if (playerList.length < 3) {
            await interaction.editReply({
                content: '人數太少了，無法開始遊戲',
            });
            return;
        }
        // 隨機排序 playerList
        playerList = playerList.sort(() => Math.random() - 0.5);

        for (let i = 0; i < playerList.length; i++) {
            const player = playerList[i];
            const question = {
                name: player.name,
                answerList: []
            };
            questionList.push(question);
        }
        gameStart = true;
        logData(playerList);
        await interaction.editReply({
            content: '開始遊戲',
            ephemeral: true,
        });
        await interaction.channel.send({
            content: '遊戲開始了！'
        });
        let orderText = '';
        for (let i = 0; i < playerList.length; i++) {
            const player = playerList[i];
            orderText += player.name
            if (i !== playerList.length - 1) {
                orderText += '→'
            }
        }
        await interaction.channel.send({
            content: `本場遊戲順序為${orderText}，請設定題目`
        });
    } catch (error) {
        console.error('處理開始遊戲時發生錯誤:', error);
        logError(error, '處理開始遊戲時發生錯誤:');
        await interaction.editReply({
            content: '開始遊戲時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}

async function handleGetMyAnswer(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (!gameStart) {
            await interaction.editReply({
                content: '遊戲尚未開始，請稍後再試',
                ephemeral: true,
            });
            return;
        }
        if (turn === 0) {
            await interaction.editReply({
                content: '出題階段中，請稍後再試',
                ephemeral: true,
            });
            return;
        }
        const player = interaction.user;
        let index = playerList.findIndex(item => item.id === player.id);
        if (index === -1) {
            await interaction.editReply({
                content: '遊戲進行中，下次請早。',
                ephemeral: true,
            });
            return;
        }
        index -= turn;
        if (index < 0) index += playerList.length;
        const question = questionList[index];
        const answer = question.answerList[question.answerList.length - 1];
        await interaction.editReply({
            content: isOddTurn() ? `你拿到了：${answer}，請輸入提示` : `你拿到了：${answer}，請輸入答案`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('處理取得答案時發生錯誤:', error);
        logError(error, '處理取得答案時發生錯誤:');
        await interaction.editReply({
            content: '取得答案時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}

async function handleSetMyAnswer(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        if (!gameStart) {
            await interaction.editReply({
                content: '遊戲尚未開始，請稍後再試',
                ephemeral: true,
            });
            return;
        }
        const player = interaction.user;
        const text = interaction.options.getString('題目或答案');
        let index = playerList.findIndex(item => item.id === player.id);
        if (index === -1) {
            await interaction.editReply({
                content: '遊戲進行中，下次請早。',
                ephemeral: true,
            });
            return;
        }
        index -= turn;
        if (index < 0) index += playerList.length;
        const question = questionList[index];
        //可以修改
        if (question.answerList.length === turn + 1) {
            question.answerList[turn] = text
            await interaction.editReply({
                content: '修改完成',
                ephemeral: true,
            });
            return;
        }
        if (question.answerList.length !== turn) {
            await interaction.editReply({
                content: '無法填入答案',
                ephemeral: true,
            });
            return;
        }

        question.answerList.push(text);
        await interaction.editReply({
            content: '設定成功',
            ephemeral: true,
        });
        turnCounter++;
        const name = playerList.find(item => item.id === player.id).name
        await interaction.channel.send({
            content: isOddTurn() ? `${name}提交了提示，本輪有${playerList.length - turnCounter}人尚未提交提示` : `${name}提交了答案，本輪有${playerList.length - turnCounter}人尚未提交答案`
        });

        if (!isProcessingTurn && turnCounter % playerList.length === 0) {
            isProcessingTurn = true; // 加鎖
            try {
                turn++;
                turnCounter = 0;
                logData(questionList);
                if (turn === playerList.length - (isEvenPlayers() ? 0 : 0)) {
                    await publishResult(interaction);
                    return;
                }
                await interaction.channel.send({
                    content: isOddTurn()
                        ? `第${turn + 1}輪開始了，請領取答案並寫下提示`
                        : `第${turn + 1}輪開始了，請領取提示並做答`
                });
            } finally {
                isProcessingTurn = false; // 解鎖
            }
        }
    } catch (error) {
        console.error('處理設定答案時發生錯誤:', error);
        logError(error, '處理設定答案時發生錯誤:');
        await interaction.editReply({
            content: '設定答案時發生錯誤，請稍後再試。',
            ephemeral: true,
        });
    }
}
//延遲
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishResult(interaction) {
    try {
        await interaction.channel.send({
            content: '最後一個答案已提交，即將開始進行結算',
        });
        for (let i = 0; i < questionList.length; i++) {
            const question = questionList[i];
            const embed = new EmbedBuilder()
                .setColor('00FF66')
                .setTitle(`${playerList[i].name}的題目是：`)
                .setDescription(question.answerList[0]);
            const maxRounds = isEvenPlayers() ? playerList.length : playerList.length;
            for (let j = 1; j < maxRounds; j++) {
                const answer = question.answerList[j];
                const type = j % 2 === 0 ? '答案' : '提示';
                let index = i + j;
                if (index >= playerList.length) index -= playerList.length;
                const player = playerList[index];
                embed.addFields(
                    { name: `${player.name}的${type}是：`, value: answer, inline: false }
                );
            }
            embed.setFooter({ text: `成功了嗎？` });
            // 回應使用者
            const reply = await interaction.channel.send({
                content: `第${i + 1}題的結果：`,
                embeds: [embed],
            });
            await reply.react('958334023636242462');
            await reply.react('958334023493632092');
            await delay(3000);
        }
        logResult();
        initializeGame();
    } catch (error) {
        console.error('處理結算時發生錯誤:', error);
        logError(error, '處理結算時發生錯誤:');
        await interaction.channel.send({
            content: '結算時發生錯誤，請稍後再試。',
        });
    }
}

async function handleInitializeGame(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        initializeGame();
        await interaction.editReply({
            content: '遊戲已重置',
        });
    } catch (error) {
        console.error('重置遊戲時發生錯誤:', error);
        logError(error, '重置遊戲時發生錯誤:');
        await interaction.editReply({
            content: '重置遊戲時發生錯誤，請稍後再試。',
        });
    }
}

function initializeGame() {
    playerList = [];
    questionList = [];
    turn = 0;
    gameStart = false;
    turnCounter = 0
}

async function handleWhisperToShrimp(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const nickname = member ? member.nickname : null;
        const displayName = nickname || interaction.user.username; // 如果沒有暱稱，就用使用者名稱        const text = interaction.options.getString('題目或答案');
        const text = interaction.options.getString('內容');
        console.log(`${displayName} 說： ${text}`);
        logMessage(displayName, text);
        await interaction.editReply({
            content: '>w<',
            ephemeral: true,
        });
    } catch (error) {
        console.error('說悄悄話時發生錯誤:', error);
        logError(error, '說悄悄話時發生錯誤:');
        await interaction.editReply({
            content: '說悄悄話時發生錯誤，請稍後再試。',
        });
    }
}

async function handlePrintPlayerList(interaction){
    try{
        await interaction.deferReply({ ephemeral: true });
        if (!gameStart) {
            await interaction.editReply({
                content: '遊戲尚未開始，請稍後再試',
                ephemeral: true,
            });
            return;
        }
        let orderText = `現在是第${turn + 1}/${playerList.length}輪，本輪作答情況：`;
        for (let i = 0; i < playerList.length; i++) {
            const player = playerList[i];
            orderText += player.name

            //確認本輪是否提交答案，先找出player這輪所屬的questionList的index

            let index = i - turn;
            if (index < 0) index += playerList.length;
            const question = questionList[index];
            if (question.answerList.length === turn + 1) {
                orderText += '✅'
            } else{
                orderText += '❌'
            }
            
            if (i !== playerList.length - 1) {
                orderText += '→'
            }
        }
        await interaction.editReply({
            content: '查看玩家順序',
            ephemeral: true,
        });
        await interaction.channel.send({
            content: `${orderText}`,
        });
    }catch (error) {
        console.error('列出玩家列表時發生錯誤:', error);
        logError(error, '列出玩家列表時發生錯誤:');
        await interaction.editReply({
            content: '列出玩家列表時發生錯誤，請稍後再試。',
        });
    }
}
// 登入機器人
client.login(process.env.DISCORD_TOKEN);

