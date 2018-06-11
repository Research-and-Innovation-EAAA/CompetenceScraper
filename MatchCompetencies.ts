import {Competence} from "./Competence";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";


async function matchCompetence(database: Database, competenceId: number, regular_exp: string) {

    // Remove old matches
    let query: string = `delete from annonce_kompetence` +
        ` WHERE kompetence_id=${competenceId}`;
    await database.execute(query);    

    // Add matches
    query = `insert ignore into annonce_kompetence (annonce_id, kompetence_id)` +
        ` SELECT a._id annonce_id, ${competenceId} kompetence_id FROM annonce a ` +
        ` WHERE a.searchable_body REGEXP "${regular_exp}"`;
    await database.execute(query);

    // Update match counter
    query = "update kompetence set advertCount=(select count(*) from annonce_kompetence ak where ak.kompetence_id="+competenceId+") where kompetence._id="+competenceId;
    await database.execute(query);

    winston.info("Finished match for competence id: ", competenceId);
}

export default async function matchCompetencies(database: Database) {
    let competencies = await database.loadCompetencies();

    for (let i=0 ; i<competencies.length ; i++) {
        let c = competencies[i];
        let regular_exp : string = c.get("overriddenSearchPatterns")?c.get("overriddenSearchPatterns"):c.get("defaultSearchPatterns");
        let id : number = c.get("_id")?competencies[i].get("_id") as number:NaN;
        await matchCompetence(database, id, regular_exp);
    }
}
