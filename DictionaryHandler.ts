import {Database} from "./Database";

/*
    The process: Load all advert texts & id on those without number format
    Convert them 1 by 1 to number format
    Save them by id.
 */


export async function convertAdvertToNumbers(database: Database){
    let data = (await database.loadAdvertTextsNoNumberFormat(1, 1000)) as {_id: number, searchable_body: string}[];

    let dataSize = data.length;

    for (let i = 0; i < data.length; i++){
        let n = i + 1;
        console.log("Progress: " + n + " of " + dataSize);
        await convertToNumbers(data[i], database)
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

