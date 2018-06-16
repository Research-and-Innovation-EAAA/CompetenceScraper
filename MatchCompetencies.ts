import {Competence} from "./Competence";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";


async function matchCompetence(database: Database, competenceId: number, regular_exp: string) {

    let advertIdScope =         ` (select a1._id from annonce a1 where a1.lastSearchableBody >  (select k.lastMatch from kompetence k where k._id=${competenceId}) is not false) `;
    let competenceUpdate = ` (select true from kompetence k1 where k1._id=${competenceId} AND (k1.lastMatch is null OR k1.lastMatch<k1.lastUpdated)) `;

    // Guard on number of ads to match
    let query: string = `select count(*) from annonce a where ((a._id) in ` +
	advertIdScope + ` OR ${competenceUpdate})`;
    let countAds = await database.getCount(query);
    winston.info(`Count ads for competence ${competenceId} => ${countAds}`);
    if (countAds==0)
       return;    

    // Remove old matches
    query = `delete FROM annonce_kompetence` +
        ` WHERE kompetence_id=${competenceId} AND ` +
	` ((annonce_id) in ` + advertIdScope + ` OR ${competenceUpdate})`;
    await database.execute(query);    

    // Add matches
    query = `insert ignore into annonce_kompetence (annonce_id, kompetence_id)` +
        ` SELECT a._id annonce_id, ${competenceId} kompetence_id FROM annonce a ` +
        ` WHERE a.searchable_body REGEXP "${regular_exp}" AND ((a._id) in ` +
	advertIdScope + ` OR ${competenceUpdate})`;
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
        let id : number = c.get("_id")?competencies[i].get("_id") as number:NaN;
        await matchCompetence(database, id, regular_exp);
    }
}
