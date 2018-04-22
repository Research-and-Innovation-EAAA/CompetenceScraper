import Puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";

let database: Database = new Database(new DatabaseOptions()
    .setHost(process.env.MYSQL_HOST)
    .setPort(Number(process.env.MYSQL_PORT))
    .setUsername(process.env.MYSQL_USERNAME)
    .setPassword(process.env.MYSQL_PASSWORD));


console.log("Hello from " + database.about());

