const Realm = require('realm')
const twilio = require('twilio')
const dateFormat = require('dateformat');
const fs = require('fs');

const ACCOUNT_SID = 'REPLACE_ME';
const AUTH_TOKEN = 'REPLACE_ME';
const TWILIO_CLIENT = twilio(ACCOUNT_SID, AUTH_TOKEN)
const TWILIO_PHONE_NUMBER = 'REPLACE_ME'
const USERNAME = "REPLACE_ME"
const PASSWORD = "REPLACE_ME"
const SERVER = "REPLACE_ME"
const DB_NAME = "REPLACE_ME"
const OBJECT_NAME = "SMSNotification"
const NEXT_UPDATE = 499

const SMSNotificationSchema = {
    name: OBJECT_NAME,
    primaryKey: 'id',
    properties: {
        id: {type: 'string', optional: false},
        patientID: {type: 'string', optional: false},
        appointmentID: {type: 'string', optional: false},
        invoiceID: {type: 'string', optional: false},
        phoneNumber: {type: 'string', optional: false},
        message: {type: 'string', optional: false},
        errorMessage: {type: 'string', optional: false},
        sendDate: {type: 'date', optional: false},
        action: {type: 'int', optional: false},
        status: {type: 'int', optional: false},
    }
}

async function getStarted() {
    // await Realm.Sync.User.login(`http://${SERVER}`, USERNAME, PASSWORD).then(user => { //if http://
    await Realm.Sync.User.login(`https://${SERVER}`, USERNAME, PASSWORD).then(user => { //if https://
        Realm.open({
            sync: {
                // url: `realm://${SERVER}/${DB_NAME}`, //if http://
                url: `realms://${SERVER}/${DB_NAME}`,//if https://
                user: user
            },
            schema: [SMSNotificationSchema],
        }).then(realm => {
            let patientResults = realm.objects(OBJECT_NAME).filtered('status = 0')
            for (let index = 0; index < patientResults.length; index++) {
                let dateFromDB = patientResults[index].sendDate
                let dateSend = dateFormat(dateFromDB, "yyyy-mm-dd hh:MM:ss")
                let textMessage = patientResults[index].message
                let phoneNumber = patientResults[index].phoneNumber
                let status = patientResults[index].status
                let id = patientResults[index].id
                let nowDate = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")
                if (status === 0) {
                    let secondsSender = Date.parse(dateSend) / 1000
                    let secondsNow = Date.parse(nowDate) / 1000
                    let diffTime = secondsSender - secondsNow
                    if (diffTime >= 0 && diffTime <= 300) {
                        TWILIO_CLIENT.messages.create({
                            body: textMessage,
                            to: phoneNumber,
                            from: TWILIO_PHONE_NUMBER
                        }, function (err, message) {
                            if (err) {
                                realm.write(() => {
                                    realm.create(OBJECT_NAME, {id: id, status: 0, errorMessage: err.message}, true);
                                });
                                let fileLogsName = dateFormat(new Date(), "yyyy-mm-dd")
                                let timeLogs = dateFormat(new Date(), "yyyy-mm-dd H:MM:ss")
                                let textLogs = '[' + timeLogs + '] [id:' + id + '] [Text failed because: ' + err.message + ']'
                                fs.appendFile('logs/' + fileLogsName + '.log', textLogs + '\n', function (err) {
                                    if (err) throw err;
                                    console.log(fileLogsName);
                                });
                                console.error('Text failed because: ' + err.message);
                            } else {
                                realm.write(() => {
                                    realm.create(OBJECT_NAME, {id: id, status: 2, errorMessage: ""}, true);
                                });
                                console.log('Text sent! Message SID: ' + message.sid);
                            }
                        });
                    } else if (diffTime < 0) {
                        realm.write(() => {
                            realm.create(OBJECT_NAME, {id: id, status: 3}, true);
                        });
                        let fileLogsName = dateFormat(new Date(), "yyyy-mm-dd")
                        let timeLogs = dateFormat(new Date(), "yyyy-mm-dd H:MM:ss")
                        let textLogs = '[' + timeLogs + '] [id:' + id + '] [Text failed because: The time the message was sent was after the script started or the database was checked]'
                        fs.appendFile('logs/' + fileLogsName + '.log', textLogs + '\n', function (err) {
                            if (err) throw err;
                            console.log(fileLogsName);
                        });
                    }
                }
            }
        })
    })
}

console.log('Start working script...')
getStarted();
setInterval((function () {
    getStarted();
}), NEXT_UPDATE * 1000);
