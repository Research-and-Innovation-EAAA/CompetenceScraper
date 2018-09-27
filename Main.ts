import * as puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import scrape from "./CompetenceScraper";
import matchCompetencies from "./MatchCompetencies";
import * as winston from "winston";
import {generateTree} from "./CompetenceJSONTreeGenerator"

type truthy = "YES" | "Y" | "1" | "true" | "True" | "TRUE";
type falsy = "NO" | "N" | "0" | "false" | "False" | "FALSE";

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
    if (!<falsy>process.env.COMPETENCIES_SCRAPE)
        await scrape(database);

    // Match competencies
    if (!<falsy>process.env.COMPETENCIES_MATCH)
        await matchCompetencies(database);

    //Generate JSON tree for R shinyTree
    //await generateTree(database);

    database.disconnect();
}

main().then(() => {
    console.log("Successful scraping ended")
}, (error) => {
    console.log("Failed scraping ended: "+error)
});
