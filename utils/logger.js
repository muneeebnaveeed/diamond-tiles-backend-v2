const winston = require('winston');
const dateformat = require('dateformat');
const chalk = require('chalk');

const format = winston.format.printf(({ label, level, message, timestamp }) => {
    let levelColor = 'blue';
    switch (level) {
        case 'error':
            levelColor = 'red';
            break;
        case 'warn':
            levelColor = 'yellow';
            break;
        case 'info':
            levelColor = 'green';
            break;
        case 'http':
            levelColor = 'magenta';
            break;
        case 'verbose':
            levelColor = 'cyan';
            break;
        case 'debug':
            levelColor = 'blue';
            break;
        default: {
            levelColor = 'gray';
            break;
        }
    }
    return `${chalk.bold(
        `[${timestamp}] ${chalk[levelColor](`${label.toUpperCase()}::${level.toUpperCase()}:`)}`
    )} ${message}`;
});

module.exports = (scope = 'SCOPE') =>
    winston.createLogger({
        transports: [
            new winston.transports.Console({
                level: 'debug',
                format: winston.format.combine(
                    winston.format.label({ label: scope }),
                    winston.format.timestamp({ format: 'DD-MMM HH:mm' }),
                    // winston.format((info) => {
                    //     if (info instanceof Error) return { ...info, stack: info.stack, message: info.message };
                    //     return info;
                    // }),
                    format
                ),
            }),
        ],
    });
