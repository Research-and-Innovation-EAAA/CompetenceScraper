import {Database} from "./Database";
import * as winston from "winston";

async function matchDataField(database: Database, dataFieldId: number, regular_exp: string, extract: string) {
    let advertIdScope: string = ` select a1._id as _id from annonce a1 where a1.lastSearchableBody >  (select df.lastMatch from dataField df where df._id=${dataFieldId}) is not false UNION select a1._id as _id from annonce a1, dataField df1 where df1._id=${dataFieldId} AND (df1.lastMatch is null OR df1.lastMatch<df1.lastUpdated) `;

    // Create temporary table of ad ids to match
    let tempTableName: string = "matchDataFieldForAdIds";

    let query: string = `DROP TABLE IF EXISTS ${tempTableName}`;

    await database.execute(query);
    query = `CREATE TABLE ${tempTableName} (count INT UNSIGNED AUTO_INCREMENT, _id INT UNSIGNED, KEY(_id), PRIMARY KEY(count)) ${advertIdScope} `;
    
    await database.execute(query);

    // Return if no ad needs to be matched
    query = `SELECT count(*) FROM ${tempTableName} LIMIT 1`;
    let scopeAds = await database.getCount(query);
    if (scopeAds<1) {
        return;
    }

    // Update match counter and time stamp
    query = "update dataField set lastMatch=NULL where dataField._id="+dataFieldId;
    await database.execute(query);

    // Remove old matches
    query = `delete FROM annonce_dataField` +
        ` WHERE dataField_id=${dataFieldId} AND ` +
        ` (annonce_id) in (select _id from ${tempTableName})`;
    await database.execute(query);



    // Add new matches
    const ROWCOUNT = 10000; // Max number of ads to match per query to avoid timeouts
    for (let offset: number = 0 ; offset<scopeAds ; offset=offset+ROWCOUNT) {
        query = `insert ignore into annonce_dataField (annonce_id, dataField_id, dataValue)` +
            ` SELECT a._id annonce_id, ${dataFieldId} dataField_id, REGEXP_REPLACE(searchable_body, '${regular_exp}','${extract}') dataValue FROM annonce a ` +
            ` WHERE ((a._id) in (select _id from ${tempTableName} WHERE count>${offset} AND count<=${offset+ROWCOUNT})) AND a.searchable_body REGEXP "${regular_exp}"`;
        //winston.info(query);
        await database.execute(query);
    }

    // Update match counter and time stamp
    query = "update dataField set lastMatch = CURRENT_TIMESTAMP() where dataField._id="+dataFieldId;
    await database.execute(query);
}

export default async function matchDataFields(database: Database) {
    let datafields = await database.loadDatafields();

    // Match all datafields against missing ads
    for (let i=0 ; i<datafields.length ; i++) {
        let d = datafields[i];
        if (!d) continue;
        let id: number = d.get("_id") ? d.get("_id") as number : NaN;
        if (!id) continue;
        //if (id != 158798) continue;

        // Output match priority
        //winston.info(`Priority=${i}, id=${id}`);

        // get regular expression
        let regular_exp = d.get("regexp");
        //get extract
        let extract = d.get("extract"); // extract contains last argument of REGEX_REPLACE.

        //winston.info(`Regular expression: "${regular_exp}"`);
        if (!regular_exp) continue;


        // match regular expression
        await (matchDataField(database, id, regular_exp,extract).then(()=>{
           // winston.info(`Finished match for datafield ${id}`);
        }).catch((err)=>{
            //winston.info(`Failed match for datafield ${id} : "${err}"`);
        }));
    }
}