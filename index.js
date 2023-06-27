const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const configs = require('./config.json');
const google = require('googleapis');
const fs = require('fs');

const youtube = new google.youtube_v3.Youtube({
    version: 'v3',
    auth: configs.GOOGLE_KEY
});
const client = new Discord.Client();

const prefixo = configs.PREFIX;

const servidores = [];

client.on("guildCreate", (guild) => {
    console.log('Id da guilda onde entrei: ' + guild.id);
    console.log('Nome da guilda onde entrei: ' + guild.name);

    servidores[guild.id] = {
        connection: null,
        dispatcher: null,
        fila: [],
        tocandoAgora: false
    }

    saveServer(guild.id);
})
client.on("ready",() => {
    loadServers();
    console.log('Estou online!');
});

client.on("message", async (msg) => {
    
    //filtro
    
    if (!msg.guild) return;

    if (!msg.content.startsWith(prefixo)) return;
    
    if (!msg.member.voice.channel) {
        msg.channel.send('Entra na call primeiro né burrão');
        return;
    }
    //comandos 
    if (msg.content === prefixo + 'join'){
        try{
            servidores[msg.guild.id].connection = await  msg.member.voice.channel.join();
        }
        catch (err) {
            console.log('ZERO ANIMO DE ENTRAR');
            console.log(err);
        }
    }

    if (msg.content === prefixo + 'leave'){
        msg.member.voice.channel.leave();
        servidores[msg.guild.id].connection = null;
        servidores[msg.guild.id].dispatcher = null;
        servidores[msg.guild.id].tocandoAgora = false;
        servidores[msg.guild.id].fila = [];
    }

    if (msg.content.startsWith(prefixo + 'play')){
        let oQueTocar = msg.content.slice(6);

        if (oQueTocar.length === 0){
            msg.channel.send('Erro ao entrar no canal de voz');
            return;
        }

        if (servidores[msg.guild.id].connection === null){
            try{
                servidores[msg.guild.id].connection = await  msg.member.voice.channel.join();
            }
            catch (err) {
                console.log('ZERO ANIMO DE ENTRAR');
                console.log(err);
            }
        }

        if (ytdl.validateURL(oQueTocar)){
            servidores[msg.guild.id].fila.push(oQueTocar);
            console.log('Musica adicionada: ' + oQueTocar);
            TocaMusicas(msg);
        }
        else{
            youtube.search.list({
                q: oQueTocar,
                part: 'snippet',
                fields: 'items(id(videoId),snippet(title, channelTitle))',
                type: 'video'
            }, function (err, resultado) {
                if (err) {
                    console.log(err);
                }
                if (resultado) {
                    const listaResultados = [];

                    //organiza resultado
                    for (let i in resultado.data.items) {
                        const montaItem = {
                            'tituloVideo': resultado.data.items[i].snippet.title,
                            'nomeCanal': resultado.data.items[i].snippet.channelTitle,
                            'id':'https://www.youtube.com/watch?v=' + resultado.data.items[i].id.videoId
                        }

                        listaResultados.push(montaItem);
                    }
                    
                    //EMBED
                    const embed = new Discord.MessageEmbed()
                        .setColor([143,23,255])
                        .setAuthor('𝐓𝐨𝐤𝐲𝐨')
                        .setDescription('Escolha sua musica!');

                    for (let i in listaResultados) {
                        embed.addField(`${parseInt(i) + 1}: ${listaResultados[i].tituloVideo}`,
                        listaResultados[i].nomeCanal);
                    }

                    msg.channel.send(embed).then((embedMessage)=> {
                        const Reacoes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

                        for (let i = 0; i < Reacoes.length; i++){
                            embedMessage.react(Reacoes[i]);
                        }
                        const filter = (reaction, user)=> {
                            return Reacoes.includes(reaction.emoji.name) 
                            && user.id === msg.author.id;
                        }
                        
                        embedMessage.awaitReactions(filter,{max: 1, time: 25000, errors: ['time']})
                        .then((collected) => {
                            const reaction = collected.first();
                            const idOpcaoEscolhida = Reacoes.indexOf(reaction.emoji.name);

                            msg.channel.send(`Voce escolheu ${listaResultados[idOpcaoEscolhida].tituloVideo} de ${listaResultados[idOpcaoEscolhida].nomeCanal}`);

                            servidores[msg.guild.id].fila.push(listaResultados[idOpcaoEscolhida].id);
                            TocaMusicas(msg);
                        })
                        .catch((error) => {
                            msg.reply('Escolha uma opção valida!');
                            console.log(error);
                        });
                    });
                }
            })
        }
    }

    if (msg.content === prefixo + 'pause'){
        servidores[msg.guild.id].dispatcher.pause();
    }

    if (msg.content === prefixo + 'resume'){
        servidores[msg.guild.id].dispatcher.resume();
    }

});

const TocaMusicas = (msg) => {
    if (servidores[msg.guild.id].tocandoAgora === false) {
        const tocando = servidores[msg.guild.id].fila[0];
        servidores[msg.guild.id].tocandoAgora = true;
        servidores[msg.guild.id].dispatcher = servidores[msg.guild.id].connection.play(ytdl(tocando, configs.YTDL));
    
        servidores[msg.guild.id].dispatcher.on('finish', () => {
            servidores[msg.guild.id].fila.shift();
            servidores[msg.guild.id].tocandoAgora = false;
            if (servidores[msg.guild.id].fila.length > 0) {
                TocaMusicas();
            }
            else {
                servidores[msg.guild.id].dispatcher = null;
            }
        })
    }
}

const loadServers = () => {
    fs.readFile('listaDeServers.json', 'utf8', (err, data) => {
        if (err) {
            console.log('ERRO 7014');
            console.log(err);
        }
        else {
            const objLe = JSON.parse(data);
            for (let i in objLe.servers){
                servidores[i] = {
                    connection: null,
                    dispatcher: null,
                    fila: [],
                    tocandoAgora: false
                }
            }
        }
    });
}

const saveServer = (idNovoServidor) => {
    fs.readFile('listaDeServers.json', 'utf8', (err, data) => {
        if (err) {
            console.log('ERRO 7014');
            console.log(err);
        }
        else {
            const objLe = JSON.parse(data);
            objLe.servers.push(idNovoServidor);
            const objEscreve = JSON.stringify(objLe);

            fs.writeFile('listaDeServers.json', objEscreve, 'utf8',() => {});
        }
    });
}
client.login(configs.TOKEN_DISCORD);