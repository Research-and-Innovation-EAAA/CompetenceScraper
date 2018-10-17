import {Competence} from "./Competence";
import {Database} from "./Database";
import * as winston from "winston";

async function matchCompetence(database: Database, competenceId: number, regular_exp: string) {

    winston.info(`Match ´${regular_exp}´ for competence id: `, competenceId);

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

    // Update match counter and time stamp
    query = "update kompetence set advertCount=null, lastMatch=NULL where kompetence._id="+competenceId;
    await database.execute(query);

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
}

async function buildSearchPattern(database: Database, competence: Competence) : Promise<string> {
    // Build default search string
    let altLabels = competence.get("altLabels");
    let labels = altLabels?altLabels.split("/"):[];
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
                let charText = specialChars.includes(char)?"\\\\\\\\"+char:char;
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
    let defaultSearchStr = anyOmittedWordEnds?searchStr:searchQuickStr;
    if (competence.get("defaultSearchPatterns") != defaultSearchStr) {
        competence.set("defaultSearchPatterns", defaultSearchStr&&defaultSearchStr.length>0?defaultSearchStr:undefined);
        await database.updateCompetence(competence);
    }

    // return RegExp to use
    let overrideRegExp =  competence.get("overriddenSearchPatterns");
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
            let c1dateStr: string | undefined = c1.get("lastMatch");
            let c2dateStr: string | undefined = c2.get("lastMatch");
            if (c1dateStr === undefined && c2dateStr === undefined)
                return 0;
            else if (c1dateStr === undefined)
                return -1;
            else if (c2dateStr === undefined)
                return 1;
            else {
                let c1matchdate: number = new Date(c1dateStr).getTime();
                let c2matchdate: number = new Date(c2dateStr).getTime();
                let c1updatedate: number = new Date(c1.get("lastUpdated")).getTime();
                let c2updatedate: number = new Date(c2.get("lastUpdated")).getTime();
                if (c1matchdate < c1updatedate && c2matchdate < c2matchdate)
                    return 0;
                else if (c1matchdate < c1updatedate)
                    return -1;
                else if (c2matchdate < c2updatedate)
                    return 1;
                else {
                    if (c1matchdate < c2matchdate)
                        return -1;
                    else if (c1matchdate > c2matchdate)
                        return 1;
                    else
                        return 0;
                }
            }
        }
    });

    // Output match priority
    for (let i=0 ; i<competencies.length ; i++) {
        let c = competencies[i];
        let id: number = c.get("_id") ? c.get("_id") as number : NaN;
        winston.info(`Priority=${i}, id=${id}`);
    }

    for (let i=0 ; i<competencies.length ; i++) {
        let c = competencies[i];

        // Match competence against adverts
        let id : number = c.get("_id")?c.get("_id") as number:NaN;

        // get regular expression
        await buildSearchPattern(database, c).then(async (regular_exp)=>{
            await matchCompetence(database, id, regular_exp).then(()=>{
                winston.info(`Finished match for competence ${id}`);
            }).catch((err)=>{
                winston.info(`Failed match for competence ${id} : "${err}"`);
            });
        }).catch((err)=>{
            winston.info(`Failed building search pattern for competence ${id} : ${err}`);
        });
    }
}
