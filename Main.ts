import * as puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import scrape from "./CompetenceScraper";
import matchCompetencies from "./MatchCompetencies";
import * as winston from "winston";
import {generateTree} from "./CompetenceJSONTreeGenerator";
import {convertAdvertToNumbers} from "./DictionaryHandler";
import matchDataFields from "./MatchDataFields";

const stringLitArray = <L extends string>(arr: L[]) => arr;

const truestring = stringLitArray(["YES", "Y", "1", "true", "True", "TRUE"]);
export type truthy = (typeof truestring)[number];
const isTrue = (x: any): x is truthy => truestring.indexOf(x) > -1;

const falsestring = stringLitArray(["NO", "N", "0", "false", "False", "FALSE"]);
export type falsy = (typeof falsestring)[number];
const isFalse = (x: any): x is falsy => falsestring.indexOf(x) > -1;

async function main() {

    // Setup database
    let database: Database = new Database(new DatabaseOptions()
        .setHost(process.env.MYSQL_HOST)
        .setPort(Number(process.env.MYSQL_PORT))
        .setDatabase(process.env.MYSQL_DATABASE)
        .setUsername(process.env.MYSQL_USER)
        .setPassword(process.env.MYSQL_PASSWORD));
    winston.info("Database: " + database.about());
    await database.connect();


    // Scrape competencies
    if (!isFalse(process.env.COMPETENCIES_SCRAPE)) {
        await scrape(database);

        //Generate JSON tree for R shinyTree
        //await generateTree(database);
    }

    // Match competencies
    if (!isFalse(process.env.COMPETENCIES_MATCH)){
        await matchCompetencies(database);
    }


    // Dictionary Gen for Machine Learning
    if (!isFalse(process.env.DICTIONARY_GEN)){
        await convertAdvertToNumbers(database);
    }

    //match datafields
    if (!isFalse(process.env.DATAFIELDS_MATCH)){
        await matchDataFields(database);
    }



    database.disconnect();
}

main().then(() => {
    console.log("Successful scraping ended")
}, (error) => {
    console.log("Failed scraping ended: "+error)
});
