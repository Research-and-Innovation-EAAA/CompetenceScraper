import * as puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import scrape from "./CompetenceScraper";
import matchCompetencies from "./MatchCompetencies";
import * as winston from "winston";


async function main() {

    // Setup database
    let database: Database = new Database(new DatabaseOptions()
        .setHost(process.env.MYSQL_HOST)
        .setPort(Number(process.env.MYSQL_PORT))
        .setDatabase(process.env.MYSQL_DATABASE)
        .setUsername(process.env.MYSQL_USERNAME)
        .setPassword(process.env.MYSQL_PASSWORD));
    winston.info("Database: " + database.about());
    await database.connect();

    // Scrape competencies
    await scrape(database);

    // Match competencies
    await matchCompetencies(database);

    database.disconnect();
}

main().then(() => {
    console.log("Successful scraping ended")
}, (error) => {
    console.log("Failed scraping ended: "+error)
});