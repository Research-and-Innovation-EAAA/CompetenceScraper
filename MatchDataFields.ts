import {Database} from "./Database";
import * as winston from "winston";
const jp = require('jsonpath');

async function matchDataField(database: Database, dataFieldId: number, jpQuery : string) {
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
    // Do cvr lookup.

    for (let offset: number = 0 ; offset<scopeAds ; offset++) {

        query = `select json from annonce WHERE (_id IN (SELECT _id FROM ${tempTableName} WHERE count>${offset} AND count<=${offset+1})) and json IS NOT NULL`;
        let json : string = await database.get(query);

        if(json.length > 0){
            let dataValue : string = await parseJSON(json,jpQuery);
            if(dataValue.length == 0){
                winston.info("Found no match for " + jpQuery + ", inserting NULL");
                query = `insert ignore into annonce_dataField (annonce_id, dataField_id, dataValue)` +
                    ` SELECT a._id annonce_id, ${dataFieldId} dataField_id, NULL dataValue FROM annonce a ` +
                    ` WHERE ((a._id) in (select _id from ${tempTableName} WHERE count>${offset} AND count<=${offset+1}))`;
            } else {
                winston.info("Found match for " + jpQuery + ", inserting " + dataValue);
                query = `insert ignore into annonce_dataField (annonce_id, dataField_id, dataValue)` +
                    ` SELECT a._id annonce_id, ${dataFieldId} dataField_id, "${dataValue}" dataValue FROM annonce a ` +
                    ` WHERE ((a._id) in (select _id from ${tempTableName} WHERE count>${offset} AND count<=${offset+1}))`;
            }
            winston.info(query);
            await database.execute(query);
        }
    }
    // Update match counter and time stamp
    query = "update dataField set lastMatch = CURRENT_TIMESTAMP() where dataField._id="+dataFieldId;
    await database.execute(query);

}

async function parseJSON( json: string, jpQuery : string){

    json = json.replace(/\r?\n|\r/g,""); //remove newlines.
    json = JSON.parse(json);

    return jp.query(json,jpQuery);
}

export default async function matchDataFields(database: Database) {
    let datafields = await database.loadDatafields();

    // Match all datafields against missing ads
    for (let i=0 ; i<datafields.length ; i++) {
        let d = datafields[i];
        if (!d) continue;
        let id: number = d.get("_id") ? d.get("_id") as number : NaN;
        if (!id) continue;

        let jpQuery: string = d.get("jsonpath");

        await (matchDataField(database, id, jpQuery).then(()=>{
            winston.info(`Finished match for datafield ${id}`);
        }).catch((err)=>{
            winston.info(`Failed match for datafield ${id} : "${err}"`);
        }));
    }
}