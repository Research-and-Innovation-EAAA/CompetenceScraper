import puppeteer, {Browser, ElementHandle} from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import winston from "winston";
import {error} from "util";

const SCRAPE_TESTING = process.env.SCRAPE_TESTING==="true";

async function getText(page: puppeteer.Page, xpath: string) {
    let textElements : ElementHandle[] = await page.$x(xpath);
    let text = await page.evaluate(h1 => h1.textContent, textElements[0]);
    winston.info(text);
    return text;
}

async function scrape(database: Database, page: puppeteer.Page) {

    // Query comptence uri from database
    let competencies : Array<any> = (await database.getCompetence() as Array<any>);
    console.log("Number of competencies: "+JSON.stringify(competencies.length));

    //Scrape each Uri
    for (let index: number = 0 ; index<competencies.length ; index++) {
        if (index>=20)
            return;

        //Navigate to URL
        let url: string = competencies[index].conceptUri;
        console.log(url);
        await page.goto(url);

        // Scrape title and description
        let title: string = await getText(page,`//*[@id="dataContainer"]/article/header/h1/text()`);
        let description: string = await getText(page,`//*[@id="dataContainer"]/article/div/p[1]/text()`);
        await database.storeTitleAndDesc(url, title, description);

        // Scrape child competencies
        let textElements : ElementHandle[] = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Snævrere færdigheder/kompetencer")]][1]/li/a/@onclick`);
        for (let id: number = 0 ; id<textElements.length ; id++) {
            let text = await page.evaluate(element => element.textContent, textElements[id]);
            let child_url = text.match(/loadConcept\('(.*)'\).*/)[1];
            database.storeCategory(child_url, url).catch((error) => {
                winston.info("Store category failed: "+error);
            }).then(()=>{});
        }

        // Scrape parent competencies
        textElements = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Bredere færdigheder/kompetencer")]][1]/li/a/@onclick`);
        for (let id: number = 0 ; id<textElements.length ; id++) {
            let text = await page.evaluate(element => element.textContent, textElements[id]);
            let parent_url = text.match(/loadConcept\('(.*)'\).*/)[1];
            database.storeCategory(url, parent_url).catch((error) => {
                winston.info("Store category failed: "+error);
            }).then(()=>{});
        }
    }
}

async function main() {

    // Setup database
    let database: Database = new Database(new DatabaseOptions()
        .setHost(process.env.MYSQL_HOST)
        .setPort(Number(process.env.MYSQL_PORT))
        .setDatabase(process.env.MYSQL_DATABASE)
        .setUsername(process.env.MYSQL_USERNAME)
        .setPassword(process.env.MYSQL_PASSWORD)
        .setTesting(SCRAPE_TESTING));
    winston.info("Database: " + database.about());
    database.connect();

    // Initialize headless browser
    const browser: Browser = await puppeteer.launch({
        headless: false //SCRAPE_TESTING === false
    });
    const page: puppeteer.Page = await browser.newPage();

    // Scrape competencies
    await scrape(database, page);

    // Clean up browser and database
    browser.close();
    database.disconnect();
}

main().then(() => {
    console.log("Successful scraping ended")
}, (error) => {
    console.log("Failed scraping ended: "+error)
});
