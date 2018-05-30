import {Competence} from "./Competence";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";


async function matchCompetence(database: Database, competenceId: number) {

    // Add matches
    let query: string = "insert ignore into annonce_kompetence (annonce_id, kompetence_id) " +
        " SELECT a._id, k._id FROM annonce a join kompetence k on k._id="+competenceId+
        " WHERE a.searchable_body REGEXP if(k.overriddenSearchPatterns is not null, k.overriddenSearchPatterns, k.defaultSearchPatterns)";
    await database.execute(query);

    // Update match counter
    query = "update kompetence set advertCount=(select count(*) from annonce_kompetence ak where ak.kompetence_id="+competenceId+") where kompetence._id="+competenceId;
    await database.execute(query);

    winston.info("Finished match for competence id: ", competenceId);
}

export default async function matchCompetencies(database: Database) {
    let competencies = await database.loadCompetencies();

    for (let i=0 ; i<competencies.length ; i++) {
        let id : number = competencies[i].get("_id")?competencies[i].get("_id") as number:NaN;
        await matchCompetence(database, id);
    }
}
