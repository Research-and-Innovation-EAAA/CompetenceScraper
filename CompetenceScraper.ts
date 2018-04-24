import Puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import winston from "winston";

let database: Database = new Database(new DatabaseOptions()
    .setHost(process.env.MYSQL_HOST)
    .setPort(Number(process.env.MYSQL_PORT))
    .setDatabase(process.env.MYSQL_DATABASE)
    .setUsername(process.env.MYSQL_USERNAME)
    .setPassword(process.env.MYSQL_PASSWORD));

function end() {
    database.disconnect();
    winston.info("Database: " + database.about());
}

database.getCompetence().then((value) => {
    console.log(value);
    end();
}, (error) => {
    console.log(error);
    end();
});

