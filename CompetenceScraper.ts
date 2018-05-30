import {Competence} from "./Competence";
import * as puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import * as winston from "winston";

let Visited_Urls = {};
const SCRAPE_TESTING = process.env.SCRAPE_TESTING==="true";


async function getText(page: puppeteer.Page, xpath: string) {
    let textElements : puppeteer.ElementHandle[] = await page.$x(xpath);
    let text = await page.evaluate(h1 => h1?h1.textContent:"", textElements[0]);
    winston.info(text);
    return text;
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
            let child: Competence = new Competence({
                "conceptUri": match[1],
                "prefferredLabel": anchor.name,
                "name": anchor.name,
                "grp": grp
            });
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
        if (!competence.get("conceptUri"))
            continue;
        await page.goto(competence.get("conceptUri") as string);

        // Scrape title and description
        competence.set("name", await getText(page,`//*[@id="dataContainer"]/article/header/h1/text()`));
        competence.set("prefferredLabel", competence.get("name"));
        competence.set("description", await getText(page,`//*[@id="dataContainer"]/article/div/p[1]/text()`));

        // Scrape alternative labels
        competence.set("altLabels", "");
        let nameElements : puppeteer.ElementHandle[] = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Alternativ betegnelse")]][1]/li/p/text()`);
        for (let id: number = 0 ; id<nameElements.length ; id++) {
            let txt = await page.evaluate(element => element.textContent, nameElements[id]);
            if (txt) {
                let altLabels = competence.get("altLabels");
                if (altLabels !== "")
                    competence.set("altLabels", altLabels += "/");
                competence.set("altLabels",txt);
            }
        }

        // Build default search string
        let labels = competence.get("altLabels").split("/");
        labels.unshift(competence.get("prefferredLabel"));
        let searchStr = "";
        let specialChars = "+*.()[]?";
        labels.forEach((label) => {
            if (label && label.length>0) {
                if (searchStr.length>0)
                    searchStr += "|";
                if (!specialChars.includes(label[0]))
                    searchStr += "[[:<:]]";
                for (let i=0 ; i<label.length ; i++) {
                    let char = label[i];
                    searchStr += char.includes(specialChars)?"\\\\"+char:char;
                }
                if (!specialChars.includes(label[label.length-1]))
                    searchStr += "[[:>:]]";
            }
        });
        competence.set("defaultSearchPatterns", searchStr&&searchStr.length>0?searchStr:undefined);

        // Update competence in database
        await database.updateCompetence(competence);

        // Scrape child competencies
        let urlElements : puppeteer.ElementHandle[] = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Snævrere færdigheder/kompetencer")]][1]/li/a/@onclick`);
        nameElements = await page.$x(`//*[@id="dataContainer"]/article/div/ul[preceding::h2[contains(., "Snævrere færdigheder/kompetencer")]][1]/li/a/text()`);
        for (let id: number = 0 ; id<urlElements.length ; id++) {
            let txt = await page.evaluate(element => element.textContent, urlElements[id]);
            let url = txt.match(/loadConcept\('(.*)'\).*/)[1];
            let child : Competence = await database.loadCompetence(url);
            if (!child.get("conceptUri")) {
                child.set("conceptUri", url);
                child.set("name", await page.evaluate(element => element.textContent, nameElements[id]));
                child.set("prefferredLabel", child.get("name"));
                child.set("grp", competence.get("grp"));
                database.storeCompetence(child)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
                database.storeCategory(child.get("conceptUri") as string, competence.get("conceptUri") as string)
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
            if (!parent.get("conceptUri")) {
                parent.set("conceptUri", url);
                parent.set("prefferredLabel", await page.evaluate(element => element.textContent, nameElements[id]));
                parent.set("name", parent.get("prefferredLabel"));
                parent.set("grp", competence.get("grp"));
                database.storeCompetence(parent)
                    .then(()=>{})
                    .catch((error) => {
                        winston.info("Store category failed: "+error);
                    });
                database.storeCategory(competence.get("conceptUri") as string, parent.get("conceptUri") as string)
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
            if (!extra.get("conceptUri")) {
                extra.set("conceptUri", url);
                extra.set("name", await page.evaluate(element => element.textContent, nameElements[id]));
                extra.set("prefferredLabel", extra.get("name"));
                database.storeCompetence(extra)
                    .then(()=>{})
                    .catch(() => {});
            }
        }
    }
}

export default async function scrape(database: Database ) {

    // Initialize headless browser
    const browser: puppeteer.Browser = await puppeteer.launch({
        headless: SCRAPE_TESTING === false
    });
    const page: puppeteer.Page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    // Scrape specific category
    let grps: string[] = [ 'ict', 'language', 'transversal'];
    for (let i=0 ; i<grps.length ; i++) {
        // Scrape and store initial toplevel IKT competencies
        await scrapegrp(database, page, grps[i]);
    }

    // Scrape recursive within database
    await scrapeRecursive(database, page);


    // Clean up browser and database
    browser.close();
}

