import {Database} from "./Database";

/*
    The process: Load all advert texts & id on those without number format
    Convert them 1 by 1 to number format
    Save them by id.
 */


export async function convertAdvertToNumbers(database: Database){

    let dataSize = ((await database.findTopAdvertId()) as {amount: number}[])[0].amount;

    console.log(dataSize);

    for (let i = 1; i <= dataSize; i++){
        console.log("Progress: " + i + " of " + dataSize);

        let data = ((await database.loadAdvertTextNoNumberFormat(i)) as {_id: number, searchable_body: string}[]);

        if (data.length > 0){
            await convertToNumbers(data[0], database)
        }

    }
}

async function convertToNumbers(advertData: {_id: number, searchable_body: string}, database: Database){
    let wordArray: string[];
    wordArray = advertData.searchable_body.split(/[0123456789'’@ .:;—?!_~,`"“•›·…”*&|()<>{}®´ \[\]\r\n/\\\-]+/);
    wordArray = wordArray.filter(Boolean);

    let numberArray: number[] = new Array(wordArray.length);


    for (let i = 0; i < wordArray.length; i++){
        if(wordArray[i].length > 55) {
            wordArray[i] = wordArray[i].substring(0,54);
        }
        numberArray[i] = ((await database.checkDictionaryWord(wordArray[i])) as {_id: number}[])[0]._id;
    }

    let numberFormatted: string = numberArray.join(" ");

    await database.execute('update annonce set numberFormat_body = "' + numberFormatted + '" where _id = ' + advertData._id)
}

