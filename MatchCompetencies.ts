import {Competence} from "./Competence";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";


async function matchCompetence(database: Database, competenceId: number, regular_exp: string) {

    let advertIdScope: string = ` select a1._id as _id from annonce a1 where a1.lastSearchableBody >  (select k.lastMatch from kompetence k where k._id=${competenceId}) is not false UNION select a1._id as _id from annonce a1, kompetence k1 where k1._id=${competenceId} AND (k1.lastMatch is null OR k1.lastMatch<k1.lastUpdated) `;
    //let advertIdScope: string = ` select a1._id as _id from annonce a1 where a1.lastSearchableBody >  (select k.lastMatch from kompetence k where k._id=165581) is not false UNION select a1._id from annonce a1, kompetence k1 where k1._id=165581 AND (k1.lastMatch is null OR k1.lastMatch<k1.lastUpdated) `;

    // Create temporary table of ad ids to match
    let tempTableName: string = "matchCompetenceForAdIds";
    //let query: string = `DROP TEMPORARY TABLE IF EXISTS ${tempTableName}`;
    let query: string = `DROP TABLE IF EXISTS ${tempTableName}`;
    //winston.info(query);
    await database.execute(query);
    query = `CREATE TABLE ${tempTableName} (PRIMARY KEY(_id)) ENGINE=MEMORY ${advertIdScope} `;
    //query = `CREATE TEMPORARY TABLE ${tempTableName} (PRIMARY KEY(_id)) ENGINE=MEMORY ${advertIdScope} `;
    //winston.info(query);
    await database.execute(query);

    // Return if no ad needs to be matched
    query = `SELECT 1 FROM ${tempTableName} LIMIT 1`;
    let countAds = await database.getCount(query);
    //winston.info(`Count ads for competence ${competenceId} => ${countAds}`);
    if (countAds!=1) {
        winston.info("Ignored match for competence id: ", competenceId);
        return;
    }

    // Remove old matches
    query = `delete FROM annonce_kompetence` +
        ` WHERE kompetence_id=${competenceId} AND ` +
	` (annonce_id) in (select _id from ${tempTableName})`;
    await database.execute(query);    

    // Add matches
    query = `insert ignore into annonce_kompetence (annonce_id, kompetence_id)` +
        ` SELECT a._id annonce_id, ${competenceId} kompetence_id FROM annonce a ` +
        ` WHERE ((a._id) in (select _id from ${tempTableName})) AND a.searchable_body REGEXP "${regular_exp}" `;
    //winston.info(query);
    await database.execute(query);

    // Update match counter and time stamp
    query = "update kompetence set advertCount=(select count(*) from annonce_kompetence ak where ak.kompetence_id="+competenceId+"), lastMatch = CURRENT_TIMESTAMP() where kompetence._id="+competenceId;
    await database.execute(query);

    winston.info("Finished match for competence id: ", competenceId);
}

export default async function matchCompetencies(database: Database) {
    let competencies = await database.loadCompetencies();

    for (let i=0 ; i<competencies.length ; i++) {
        let c = competencies[i];

	// Match competence against adverts
	let regular_exp : string = c.get("overriddenSearchPatterns")?c.get("overriddenSearchPatterns"):c.get("defaultSearchPatterns");
        let id : number = c.get("_id")?c.get("_id") as number:NaN;
        //if (id!=12550) continue;
        await matchCompetence(database, id, regular_exp);
    }
}
