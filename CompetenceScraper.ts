import Competence from "./Competence";
import puppeteer, {Browser, ElementHandle} from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import winston from "winston";
//import {error} from "util";

const SCRAPE_TESTING = process.env.SCRAPE_TESTING==="true";

async function getText(page: puppeteer.Page, xpath: string) {
    let textElements : ElementHandle[] = await page.$x(xpath);
    let text = await page.evaluate(h1 => h1?h1.textContent:"", textElements[0]);
    winston.info(text);
    return text;
}

async function scrape(database: Database, page: puppeteer.Page) {
    // Scrape specific category
    let grps: string[] = [ 'ict', 'language', 'transversal'];
    for (let i=0 ; i<grps.length ; i++) {
        // Scrape and store initial toplevel IKT competencies
        await scrapegrp(database, page, grps[i]);
    }

    // Scrape recursive within database
    await scrapeRecursive(database, page);
}

async function scrapegrp(database: Database, page: puppeteer.Page, grp: string) {
    await page.goto("https://ec.europa.eu/esco/portal/skill");
    await page.select('#conceptFilterList', grp);
    await page.click('#sidebarToggle');
    const anchors = await page.evaluate((grp) => {
        let selector: string = 'ul[esco-concept-block='+grp+'] a[onclick]';
        let anchors = document.querySelectorAll(selector);
        return [].map.call(anchors, (a: any) => {return {onclick: a.getAttribute('onclick'), name: a.textContent}});
    }, grp);
    for (let index=0 ; index<anchors.length ; index++ ) {
        let anchor = anchors[index];
        let onclickVal = anchor.onclick;
        //console.log(onclick);
        if (onclickVal) {
            let match = onclickVal.match(/loadConcept\('(.*)'\).*/);
            if (!match)
                continue;
            let child: Competence = new Competence(undefined,
                undefined,
                match[1],
                undefined,
                anchor.name,
                anchor.name,
                //undefined,
                grp);
            await database.storeCompetence(child)
                .catch(() => {})
                .then(()=>{});
        }
    }
}

async function scrapeRecursive(database: Database, page: puppeteer.Page) {
    // Query comptence uri from database
    let competencies = await database.loadCompetencies();
    console.log("Number of competencies: "+JSON.stringify(competencies.length));

    //Scrape each Uri
    for (let index: number = 0 ; index<competencies.length ; index++) {
        let competence: Competence = competencies[index];
        //console.log(url);
        await page.goto(competence.conceptUri as string);

        // Scrape title and description
        competence.name = competence.prefferredLabel = await getText(page,`//*[@id="dataContainer"]/article/header/h1/text()`);
        competence.description = await getText(page,`//*[@id="dataContainer"]/article/div/p[1]/text()`);

        // Scrape alternative labels
        competence.altLabels = "";
        let nameElements : ElementHandle[] = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Alternativ betegnelse")]][1]/li/p/text()`);
        for (let id: number = 0 ; id<nameElements.length ; id++) {
            let txt = await page.evaluate(element => element.textContent, nameElements[id]);
            if (txt) {
                if (competence.altLabels !== "")
                    competence.altLabels += "/";
                competence.altLabels += txt;
            }
        }

        // Update competence in database
        await database.updateCompetence(competence);

        // Scrape child competencies
        let urlElements : ElementHandle[] = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Snævrere færdigheder/kompetencer")]][1]/li/a/@onclick`);
        nameElements = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Snævrere færdigheder/kompetencer")]][1]/li/a/text()`);
        for (let id: number = 0 ; id<urlElements.length ; id++) {
            let txt = await page.evaluate(element => element.textContent, urlElements[id]);
            let url = txt.match(/loadConcept\('(.*)'\).*/)[1];
            let child : Competence = await database.loadCompetence(url);
            if (!child.conceptUri) {
                child.conceptUri = url;
                child.name = child.prefferredLabel
                    = await page.evaluate(element => element.textContent, nameElements[id]);
                child.grp = competence.grp;
                database.storeCompetence(child)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
                database.storeCategory(child.conceptUri as string, competence.conceptUri as string)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
            }
        }

        // Scrape parent competencies
        urlElements = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Bredere færdigheder/kompetencer")]][1]/li/a/@onclick`);
        nameElements = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Bredere færdigheder/kompetencer")]][1]/li/a/text()`);
        for (let id: number = 0 ; id<urlElements.length ; id++) {
            let txt = await page.evaluate(element => element.textContent, urlElements[id]);
            let url = txt.match(/loadConcept\('(.*)'\).*/)[1];
            let parent : Competence = await database.loadCompetence(url);
            if (!parent.conceptUri) {
                parent.conceptUri = url;
                parent.name = parent.prefferredLabel
                    = await page.evaluate(element => element.textContent, nameElements[id]);
                parent.grp = competence.grp;
                database.storeCompetence(parent)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
                database.storeCategory(competence.conceptUri as string, parent.conceptUri as string)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
            }
        }

        // Scrape additional competencies
        let headXpath = `//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Nødvendig færdighed/kompetence inden for")] or preceding::h2[contains(., "Supplerende færdighed/kompetencer inden for")]][1]/li/a/`;
        urlElements = await page.$x(headXpath+`@onclick`);
        nameElements = await page.$x(headXpath+`text()`);
        for (let id: number = 0 ; id<urlElements.length ; id++) {
            let text = await page.evaluate(element => element.textContent, urlElements[id]);
            let url = text.match(/loadConcept\('(.*)'\).*/)[1];
            let extra : Competence = await database.loadCompetence(url);
            if (!extra.conceptUri) {
                extra.conceptUri = url;
                extra.name = extra.prefferredLabel = await page.evaluate(element => element.textContent, nameElements[id]);
                database.storeCompetence(extra)
                    .then(()=>{})
                    .catch(() => {});
            }
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
        headless: SCRAPE_TESTING === false
    });
    const page: puppeteer.Page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7'
    });

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
