import Competence from "./Competence";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";

export default async function matchCompetencies(database: Database) {
    let competencies = await database.loadCompetencies()

        for (let i=0 ; i<competencies.length ; i++) {
            let query: string = "insert ignore into annonce_kompetence (annonce_id, kompetence_id) " +
                " SELECT a._id, k._id FROM annonce a join kompetence k on k._id="+competencies[i]._id+
                " WHERE a.searchable_body REGEXP if(k.overriddenSearchPatterns is not null, k.overriddenSearchPatterns, k.defaultSearchPatterns)";
            let result = await database.execute(query);
            winston.info("Finished match for competence id: ", competencies[i]._id);
        }
}
