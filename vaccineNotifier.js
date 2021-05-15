require('dotenv').config()
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');
const notifier = require('./notifier');
/**
Step 1) Enable application access on your gmail with steps given here:
 https://support.google.com/accounts/answer/185833?p=InvalidSecondFactor&visit_id=637554658548216477-2576856839&rd=1

Step 2) Enter the details in the file .env, present in the same folder

Step 3) On your terminal run: npm i && pm2 start vaccineNotifier.js

To close the app, run: pm2 stop vaccineNotifier.js && pm2 delete vaccineNotifier.js
 */

const PINCODE = process.env.PINCODE
const EMAIL = process.env.TO_EMAIL
const AGE = process.env.AGE
const NUM_OF_DAYS = process.env.NUM_OF_DAYS

async function main(){
    try {
        cron.schedule('* * * * *', async () => {
             await checkAvailability();
        });
    } catch (e) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw e;
    }
}

async function checkAvailability() {

    let datesArray = await fetchNext10Days();
    datesArray.forEach(date => {
        getSlotsForDate(date);
    })
}

function getSlotsForDate(DATE) {
    let config = {
        method: 'get',
        url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=143&date=' + DATE,
        headers: {
            'accept': 'application/json',
            'Accept-Language': 'hi_IN',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'
        }
    };

    

    axios(config)
        .then(function (slots) {
            let centers = slots.data.centers;
            let centersWithAvailableSlots = [];
            centers.forEach((center) => {
                let validSlots = center.sessions.filter(slot => slot.min_age_limit <= AGE &&  slot.available_capacity > 1)
                if (validSlots.length > 0)
                    centersWithAvailableSlots.push({
                        'name': center.name,
                        'address': center.address,
                        'pincode': center.pincode,
                        'slots' : validSlots
                    });
                
            });
            console.log({checked:moment().format('DD-MM-YYYY HH:mm:ss'), date: DATE, centersWithAvailableSlots: centersWithAvailableSlots.length});
            if(centersWithAvailableSlots.length > 0) {
                notifyMe(centersWithAvailableSlots);
            }
        })
        .catch(function (error) {
            console.log(error);
        });
}

async function notifyMe(validSlots){
    let slotDetails = JSON.stringify(validSlots, null, '\t');
    notifier.sendEmail(EMAIL, 'VACCINE AVAILABLE', slotDetails, (err, result) => {
        if(err) {
            console.error({err});
        }
    })
};

async function fetchNext10Days(){
    let dates = [];
    let today = moment();
    for(let i = 0 ; i < NUM_OF_DAYS ; i++ ){
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}


main()
    .then(() => {console.log('Vaccine availability checker started.');});
