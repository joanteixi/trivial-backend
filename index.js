const fs = require('fs');
const csv = require('csv-parser');

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
let results = {}
let questions = {}
let questions2 = [
    { question: "What is the capital of France?", options: ["Paris", "Rome", "London", "Madrid"], answer: "Paris" },
    { question: "What is the highest mountain in the world?", options: ["Mount Everest", "K2", "Kangchenjunga", "Lhotse"], answer: "Mount Everest" },
    { question: "Who painted the Mona Lisa?", options: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Vincent van Gogh"], answer: "Leonardo da Vinci" }];

function selectRandomRows(numRowsToSelect) {
    const results = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream('questions.csv')
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                // Randomly select a number of rows
                const selectedRows = [];
                for (let i = 0; i < numRowsToSelect; i++) {
                    const randomIndex = Math.floor(Math.random() * results.length);
                    let el = results[randomIndex]
                    el['answers'] = eval(el['answers']);
      
                    
                    selectedRows.push(el);
                    results.splice(randomIndex, 1);
                }
                resolve(selectedRows);
            });
    });
}

// Call the function to select 10 random rows from the data.csv file
selectRandomRows(10)
    .then(selectedRows => {
        questions = selectedRows;
        console.log('random', questions);
    })
    .catch(error => console.error(error));
// Call the function to select 10 random rows from the data.csv file



io.on('connection', (socket) => {
    socket.join('room1');
    
    socket.on('check', (room) => {
        console.log('id', socket.id)
    })

    socket.on('reset', (room) => {
        ranking = {}
        results = {}
        reset()
        selectRandomRows(10)
    .then(selectedRows => {
        questions = selectedRows;
        console.log('random', questions);
    })
    .catch(error => console.error(error));
// Call the function to select 10 random rows from the data.csv file


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

        timeInterval = 15000
        questionTime = timeInterval - 5000
        io.in(room).emit('new_question', { 'question': questions[currentQuestion], 'ranking': ranking });
        setTimeout(function () {
            io.in(room).emit('answer_results', { 'results': results, 'ranking': ranking })
        }, questionTime)

        const questionInterval = setInterval(() => {
            currentQuestion++

            if ((currentQuestion) >= questions.length) {
                clearInterval(questionInterval)
                console.log('gamover')
                io.in(room).emit('game_over', { 'ranking': ranking });
            } else {
                io.in(room).emit('new_question', { 'question': questions[currentQuestion], 'ranking': ranking });
                setTimeout(function () {
                    io.in(room).emit('answer_results', { 'results': results, 'ranking': ranking })
                }, questionTime)
            }

        }, timeInterval)
    })


    socket.on('answer', (answer, name) => {

        results[name] = answer
        if (answer === questions[currentQuestion].good_answer) {
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