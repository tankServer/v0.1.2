const express = require('express');
const winston = require('winston');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 5000;

try{
    fs.writeFile(path.join(__dirname, 'logs/access.log'),'\tAccsess.log\n', () => {console.log("Accsess.log is clear")});
    fs.writeFile(path.join(__dirname, 'logs/combined.log'),'\tCombied.log\n', () => {console.log("Combined.log is clear")});
    fs.writeFile(path.join(__dirname, 'logs/errors.log'),'\tErrors.log\n', () => {console.log("Errors.log is clear")});
} catch (err) {
    console.log(err);
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({filename: 'logs/combined.log'}),
        new winston.transports.File({
            filename: 'logs/errors.log',
            level: 'error',
            handleRejections: true
        })
    ]
});

const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs/access.log'),
    {flags: 'a'}
);

app.use(morgan('combined', {stream: accessLogStream}));

app.use(cors({
    origin: ['http://localhost:80','http://127.0.0.1:80','http://127.0.0.1','http://localhost','http://localhost:5000','http://127.0.0.1:5000']
}));

let Gpio;

try{
    Gpio = require('onoff').Gpio;
} catch (err) {
    logger.error('Module onoff not found. Use virtual pins');
    Gpio = class{
        constructor(pin,direction){
            this.pin = pin;
            this.direction = direction;
        }

        write = function (value){
            console.log(this.pin,'=',value);
        }
    }
}

 const [outLeftForward,outLeftBack,outRightForward,outRightBack] = [new Gpio(4,'out'),new Gpio(17,'out'),new Gpio(18,'out'),new Gpio(27,'out')];

class Tank {
    constructor(leftForward,leftBack,rightForward,rightBack) {
        this.right = 0;
        this.left = 0;
        this.isMoving = false;
        this.outLeftForward = leftForward;
        this.outLeftBack = leftBack;
        this.outRightForward = rightForward;
        this.outRightBack = rightBack;
    }

    setDirection(side, direction) {
        const value = {forward: 1, back: -1, stop: 0}[direction];
        const prevState = this.getState();

        try {
            if (side === 'A') {
                if (value === 0) {
                    this.left = this.right = 0;
                } else {
                    if (value === this.left && value === this.right) {
                        this.left = this.right = 0;
                    } else {
                        this.right = this.left = (value !== undefined ? value : 0);
                    }
                }
            }
            if (side === 'R') {
                if (value === this.right) {
                    this.right = 0;
                } else {
                    this.right = value !== undefined ? value : 0;
                }
            }
            if (side === 'L') {
                if (value === this.left) {
                    this.left = 0;
                } else {
                    this.left = value !== undefined ? value : 0;
                }
            }

            updatePins(this);

            this.isMoving = this.left === this.right && this.right === 0;

            logger.info('Tank state changed', {
                action: 'setDirection',
                side,
                direction,
                previousState: prevState,
                newState: this.getState()
            });
        } catch (error) {
            logger.error('Direction change failed', {
                error: error.message,
                stack: error.stack,
                side,
                direction
            });
            throw error;
        }
    }

    getState() {
        return {left: this.left, right: this.right, isMoving: this.isMoving};
    }
}

function updatePins(tank) {
    try{
        tank.outLeftForward.write(tank.left === 1 ? 'HIGH' : 'LOW');
        tank.outLeftBack.write(tank.left === -1 ? 'HIGH' : 'LOW');
        tank.outRightForward.write(tank.right === 1 ? 'HIGH' : 'LOW');
        tank.outRightBack.write(tank.right === -1 ? 'HIGH' : 'LOW');
    } catch (error){
        logger.error('Update pins failed',{
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

const tank = new Tank(outLeftForward, outLeftBack, outRightForward, outRightBack);

app.use(express.json());
app.use(express.static('public'));

app.post('/api/control', (req, res) => {
    try {
        const {side, direction} = req.body;

        if (!['L', 'R', 'A'].includes(side?.toUpperCase())) {
            logger.warn('Invalid side parameter', {receivedSide: side});
            return res.status(400).json({error: 'Invalid side parameter'});
        }

        if (!['forward', 'back', 'stop'].includes(direction)) {
            logger.warn('Invalid direction parameter', {receivedDirection: direction});
            return res.status(400).json({error: 'Invalid direction parameter'});
        }

        tank.setDirection(side.toUpperCase(), direction);
        res.json(tank.getState());
    } catch (error) {
        next(error);
    }
});

app.get('/api/state', (req, res) => {
    logger.info('State request', {ip: req.ip});
    res.json(tank.getState());
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

app.listen(port, () => {
    logger.info(`Server started on port ${port}`);
    console.log(`Server running at http://localhost:${port}`);
});