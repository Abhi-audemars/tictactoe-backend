const { Socket } = require("dgram");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 3000;

var server = http.createServer(app);

const Room = require("./models/room");

const io = require("socket.io")(server);


app.use(express.json());
mongoose.set('strictQuery', true);

const DB = "mongodb+srv://Abhishek:12527@cluster0.hv8d75q.mongodb.net/?retryWrites=true&w=majority";
io.on("connection", (socket) => {
    console.log("connected!.............");
    socket.on("createRoom", async ({ nickname }) => {
        console.log(nickname);

        try {
            let room = new Room();
            let player = {
                socketID: socket.id,
                nickname,
                playerType: 'X',
            };
            room.players.push(player);
            room.turn = player;
            room = await room.save();
            console.log(room);
            const roomID = room._id.toString();
            socket.join(roomID);

            io.to(roomID).emit("roomCreateSuccess", room);
        } catch
        (e) {
            console.log(e);
        }
    })

    socket.on("joinRoom", async ({ nickname, roomID }) => {
        try {
            if (!roomID.match(/^[0-9a-fA-F]{24}$/)) {
                socket.emit('errorOccured', 'Please enter a valid room ID!');
                return;
            }
            let room = await Room.findById(roomID);
            if (room.isJoin) {
                let Player = {
                    nickname,
                    socketID: socket.id,
                    playerType: 'O',


                }
                socket.join(roomID);
                room.players.push(Player);
                room.isJoin = false;
                room = await room.save();
                io.to(roomID).emit("joinRoomSuccess", room);
                io.to(roomID).emit("updatePlayers", room.players);
                io.to(roomID).emit("updateRoom", room);

            } else {
                socket.emit('errorOccured', "The game is in progress,try again later!");
            }

        } catch (e) {
            console.log(e);
        }
    });

    socket.on("tap", async ({ index, roomID }) => {
        try {

            let room = await Room.findById(roomID);
            let choice = room.turn.playerType; //x or o
            if (room.turnIndex == 0) {
                room.turn = room.players[1];
                room.turnIndex = 1;
            } else {
                room.turn = room.players[0];
                room.turnIndex = 0;
            }
            room = await room.save();
            io.to(roomID).emit("tapped", {
                index,
                choice,
                room,
            })

        } catch (e) {

        }
    })
    socket.on("winner", async ({ winnerSocketID, roomID }) => {
        try {
            let room = await Room.findById(roomID);
            let player = room.players.find((playerr) => playerr.socketID == winnerSocketID);
            player.points += 1;
            console.log(player.points);
            room = await room.save();

            if (player.points >= room.maxRound) {
                io.to(roomID).emit("endGame", player);
            } else {
                io.to(roomID).emit("pointsIncrease", player);
            }


        } catch (e) {
            console.log(e)
        }

    });
});

mongoose.connect(DB).then(() => {
    console.log("connection good")
}).catch((e) => {
    console.log(e);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`server started ${PORT}`)
});