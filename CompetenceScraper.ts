import Puppeteer from "puppeteer";
import {Database, DatabaseOptions} from "./Database";
import winston from "winston";

let database: Database = new Database(new DatabaseOptions()
    .setHost(process.env.MYSQL_HOST)
    .setPort(Number(process.env.MYSQL_PORT))
    .setUsername(process.env.MYSQL_USERNAME)
    .setPassword(process.env.MYSQL_PASSWORD));

winston.info("Hello from " + database.about());

