import {Competence} from "./Competence";
import {Database} from "./Database";
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
    query = `CREATE TABLE ${tempTableName} (count INT UNSIGNED AUTO_INCREMENT, _id INT UNSIGNED, KEY(_id), PRIMARY KEY(count)) ENGINE=MEMORY ${advertIdScope} `;
    //query = `CREATE TEMPORARY TABLE ${tempTableName} (PRIMARY KEY(_id)) ENGINE=MEMORY ${advertIdScope} `;
    //winston.info(query);
    await database.execute(query);

    // Return if no ad needs to be matched
    query = `SELECT count(*) FROM ${tempTableName} LIMIT 1`;
    let scopeAds = await database.getCount(query);
    winston.info(`Competence ${competenceId} miss to search ${scopeAds} ads`);
    if (scopeAds<1) {
        winston.info("Ignored match for competence id: ", competenceId);
        return;
    }

    // Update match counter and time stamp
    query = "update kompetence set advertCount=null, lastMatch=NULL where kompetence._id="+competenceId;
    await database.execute(query);

    // Remove old matches
    query = `delete FROM annonce_kompetence` +
        ` WHERE kompetence_id=${competenceId} AND ` +
        ` (annonce_id) in (select _id from ${tempTableName})`;
    winston.info(query);
    await database.execute(query);

    // Add new matches
    const ROWCOUNT = 10000; // Max number of ads to match per query to avoid timeouts
    for (let offset: number = 0 ; offset<scopeAds ; offset=offset+ROWCOUNT) {
        query = `insert ignore into annonce_kompetence (annonce_id, kompetence_id)` +
            ` SELECT a._id annonce_id, ${competenceId} kompetence_id FROM annonce a ` +
            ` WHERE ((a._id) in (select _id from ${tempTableName} WHERE count>${offset} AND count<=${offset+ROWCOUNT})) AND a.searchable_body REGEXP "${regular_exp}" `;
        winston.info(query);
        await database.execute(query);
    }

    // Update match counter and time stamp
    query = "update kompetence set advertCount=(select count(*) from annonce_kompetence ak where ak.kompetence_id="+competenceId+"), lastMatch = CURRENT_TIMESTAMP() where kompetence._id="+competenceId;
    await database.execute(query);
}

async function buildSearchPattern(database: Database, competence: Competence) : Promise<string> {
    // Build default search string
    let altLabels = competence.get("altLabels");
    let labels = typeof altLabels==='string' && altLabels?altLabels.split("/"):[];
    labels.unshift(competence.get("prefferredLabel"));
    let searchStr = "";
    let searchQuickStr = "";
    let anyOmittedWordEnds : boolean = false;
    let specialChars = "%_#+*.()[]?";
    labels.forEach((label) => {
        if (label && label.length>0) {
            if (searchStr.length>0) {
                searchStr += "|";
                searchQuickStr += "|";
            }
            if (specialChars.includes(label[0]))
                anyOmittedWordEnds = true;
            else
                searchStr += "[[:<:]]";
            for (let i=0 ; i<label.length ; i++) {
                let char = label[i];
                let charText = specialChars.includes(char)?"\\\\"+char:char;
                searchStr += charText;
                searchQuickStr += charText;
            }
            if (specialChars.includes(label[label.length-1]))
                anyOmittedWordEnds = true;
            else
                searchStr += "[[:>:]]";
        }
    });
    if (labels.length>1) {
        searchStr = "("+searchStr+")";
        searchQuickStr = "("+searchQuickStr+")";
    }
    searchStr = "(?i)"+searchStr;
    searchQuickStr = "(?i)[[:<:]]"+searchQuickStr+"[[:>:]]";
    let defaultSearchStr : string = anyOmittedWordEnds?searchStr:searchQuickStr;
    if (competence.get("defaultSearchPatterns") != defaultSearchStr) {
        competence.set("defaultSearchPatterns", defaultSearchStr&&defaultSearchStr.length>0?defaultSearchStr:undefined);
        await database.updateCompetence(competence);
    }

    // return RegExp to use
    let overrideRegExp : string =  competence.get("overriddenSearchPatterns");
    return overrideRegExp?overrideRegExp:defaultSearchStr;
}

export default async function matchCompetencies(database: Database) {
    let competencies = await database.loadCompetencies();
    competencies.sort((c1,c2)=> {
        let c1count : number | undefined = c1.get("advertCount");
        let c2count : number | undefined = c2.get("advertCount");
        if (c1count === undefined && c2count === undefined)
            return 0;
        else if (c1count === undefined)
            return -1;
        else if (c2count === undefined)
            return 1;
        else {
            let c1match: Date | undefined = c1.get("lastMatch");
            let c2match: Date | undefined = c2.get("lastMatch");
            if (c1match === c2match)
                return 0;
            else if (c1match === undefined)
                return -1;
            else if (c2match === undefined)
                return 1;
            else {
                let c1update: Date | undefined = c1.get("lastUpdated");
                let c2update: Date | undefined = c1.get("lastUpdated");
                if (c1match < c1update && c2match < c2update)
                    return 0;
                else if (c1match < c1update)
                    return -1;
                else if (c2match < c2update)
                    return 1;
                else {
                    if (c1match < c2match)
                        return -1;
                    else if (c1match > c2match)
                        return 1;
                    else
                        return 0;
                }
            }
        }
    });

    // Match all competencies against missing ads
    for (let i=0 ; i<competencies.length ; i++) {
        let c = competencies[i];
        if (!c) continue;
        let id: number = c.get("_id") ? c.get("_id") as number : NaN;
        if (!id) continue;
        //if (id != 158798) continue;

        // Output match priority
        winston.info(`Priority=${i}, id=${id}`);

        // get regular expression
        let regular_exp = await (buildSearchPattern(database, c).catch((err)=>{
            winston.info(`Failed building search pattern for competence ${id} : ${err}`);
        }));
        winston.info(`Regular expression: "${regular_exp}"`);
        if (! regular_exp) continue;


        // match regular expression
        await (matchCompetence(database, id, regular_exp).then(()=>{
            winston.info(`Finished match for competence ${id}`);
        }).catch((err)=>{
            winston.info(`Failed match for competence ${id} : "${err}"`);
        }));
    }
}
