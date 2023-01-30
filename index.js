const app = require('express')();
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
    cors: { origin: '*' }
});

const port = process.env.PORT || 8080


const { setMaxIdleHTTPParsers } = require('http');
const { addUser, removeUser, reset,
    getUsersInRoom } = require("./users");

let ranking = {}
const questions = [
    { question: "What is the capital of France?", options: ["Paris", "Rome", "London", "Madrid"], answer: "Paris" },
    { question: "What is the highest mountain in the world?", options: ["Mount Everest", "K2", "Kangchenjunga", "Lhotse"], answer: "Mount Everest" },
    { question: "Who painted the Mona Lisa?", options: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Vincent van Gogh"], answer: "Leonardo da Vinci" }];
let results = {}


io.on('connection', (socket) => {
    socket.join('room1');

    socket.on('check', (room) => {
        console.log('id', socket.id)
    })

    socket.on('reset', (room) => {
        ranking = {}
        results = {}
        reset()
    })


    let currentQuestion = 0;

    socket.on('join_game', ({ room, username }, callback) => {
        console.log('join_game', username)
        const { error, user } = addUser(
            { id: socket.id, name: username, room: room });

        if (error) return callback(error);

        ranking[username] = 0
        results[username] = ''

        // Emit will send message to the user
        // who had joined
        socket.emit('message', {
            user: 'admin', text:
                `${user.name},
            welcome to room ${user.room}.`
        });

        // Broadcast will send message to everyone
        // in the room except the joined user
        socket.broadcast.to(user.room)
            .emit('message', {
                user: "admin",
                text: `${user.name}, has joined`
            });

        socket.join(user.room);

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    })

    socket.on('begin', (room) => {
        
        timeInterval = 10000
        questionTime = timeInterval - 5000

        io.in(room).emit('new_question', { 'question': questions[currentQuestion], 'ranking': ranking });
        setTimeout(function() {
            io.in(room).emit('answer_results', {'results': results, 'ranking': ranking})
        }, questionTime)

        const questionInterval = setInterval(() => {
            currentQuestion++
            
            if ((currentQuestion) >= questions.length) {
                clearInterval(questionInterval)
                console.log('gamover')
                io.in(room).emit('game_over', { 'ranking': ranking });
            } else {
                io.in(room).emit('new_question', { 'question': questions[currentQuestion], 'ranking': ranking });
                setTimeout(function() {
                    io.in(room).emit('answer_results', {'results': results, 'ranking': ranking})
                }, questionTime)
            }

        }, timeInterval)
    })


    socket.on('answer', (answer, name) => {

        results[name] = answer
        if (answer === questions[currentQuestion].answer) {
            ranking[name] += 1000

           // socket.emit('result', {'result': 'correct', 'answers': answers);
        //} else {
        //   socket.emit('result', 'incorrect');
        }
    });

    socket.on('disconnect', () => {
        console.log('disconected')
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit('message',
                {
                    user: 'admin', text:
                        `${user.name} had left`
                });
        }
    })

    socket.on('message', (message) => {
        console.log(message);
        io.emit('message', `${socket.id.substr(0, 2)}: ${message}`);
    });


});

httpServer.listen(port, () => console.log(`listening on port ${port}`));