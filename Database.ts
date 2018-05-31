import {Competence} from "./Competence";
import * as MYSQL from "mysql";
import winston from "winston";
import {isObject} from "util";

const COMPETENCE = "kompetence";
const COMPETENCE_CATEGORY = "kompetence_kategorisering";
const TITLE = "name";
const DESCRIPTION = "description";
const CONCEPTURI = "conceptUri";

// NOTE: only escapes a " if it's not already escaped
function escapeDoubleQuotes(str: string) : string {
    return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
}

export class DatabaseOptions {
    private host: string = "localhost";
    private port: number = 3306;
    private database: string | undefined = undefined;
    private username: string = "root";
    private password: string | undefined = undefined;
    private testing: boolean = false;

    setHost(host : string | undefined) : DatabaseOptions {
        this.host = host && host.length > 0 ? host : this.host;
        return this;
    }
    getHost() : string {
        return this.host;
    }

    setPort(port : number | undefined) : DatabaseOptions {
        this.port = port && port > 0 ? port : this.port;
        return this;
    }
    getPort() : number {
        return this.port;
    }

    setDatabase(database : string | undefined) : DatabaseOptions {
        this.database = database && database.length > 0 ? database : this.database;
        return this;
    }
    getDatabase() : string | undefined {
        return this.database;
    }

    setUsername(username : string | undefined) : DatabaseOptions {
        this.username = username && username.length > 0 ? username : this.username;
        return this;
    }
    getUsername() : string {
        return this.username;
    }

    setPassword(password : string | undefined) : DatabaseOptions {
        this.password = password && password.length > 0 ? password : this.password;
        return this;
    }
    getPassword() : string | undefined  {
        return this.password;
    }

    setTesting(testing : boolean) : DatabaseOptions {
        this.testing = testing;
        return this;
    }
    getTesting() : boolean  {
        return this.testing;
    }

    about(): string {
        return (this.testing?"Testing ":"")+"Server="+this.getHost()+";Port="+this.getPort()+";Database="+this.getDatabase()+";Uid="+this.getUsername()+";Pwd="+this.getPassword();
    };

    constructor() {};
}

export class Database {
    private conn: MYSQL.Connection | undefined = undefined;

    constructor(private options: DatabaseOptions) {
        this.conn = undefined;
    }

    async connect() : Promise<MYSQL.Connection> {
        this.conn = MYSQL.createConnection({
            host: this.options.getHost(),
            port: this.options.getPort(),
            user: this.options.getUsername(),
            password: this.options.getPassword(),
            database: this.options.getDatabase()
        });
        let Connection = this.conn;
        return new Promise<MYSQL.Connection>((resolve,reject) => {
            Connection.connect((err) => {
                if (err)
                    reject(err);
                else
                    resolve(Connection);
            });
        });
    }

    disconnect() {
        if (this.isConnected()) {
            (this.conn as MYSQL.Connection).destroy();
        }
        this.conn = undefined;
    }

    isConnected() : boolean {
        return this.conn != undefined;
    }

    about(): string {
        return this.options.about();
    };

    loadCompetencies() : Promise<Competence[]> {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined) {
                reject(new Error("Not connected to database"));
                return;
            }
            let q = `SELECT _id, altLabels, conceptUri, description, name, prefferredLabel, kompetencecol, grp FROM ${COMPETENCE}`;
            if (this.options.getTesting()) {
                winston.info(q);
                resolve([]);
            } else {
                (this.conn as MYSQL.Connection).query(q, function (error, response) {
                    if (error) reject(error);
                    let result: Array<Competence> = [];
                    let fields: string = "";
                    for (let i=0 ; i<response.length ; i++) {
                        result[i] = new Competence();
                        for (let key in response[i]) {
                            let prop = response[i][key];
                            if (prop)
                                result[i][key as keyof Competence] = prop;
                        }
                    }
                    resolve(result);
                });
            }
        });
    }

    storeCategory(url: string, parent_url: string) {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined)
                reject(new Error("Not connected to database"));
            else {
                let q = `INSERT INTO ${COMPETENCE_CATEGORY} (superkompetence, subkompetence) VALUES ("${parent_url}", "${url}")`;
                if (this.options.getTesting()) {
                    winston.info(q);
                    resolve();
                } else {
                    (this.conn as MYSQL.Connection).query(q, function (error) {
                        if (error) reject(error);
                        resolve();
                    });
                }
            }
        });
    }

    loadCompetence(conceptUri: string) : Promise<Competence> {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined) {
                reject(new Error("Not connected to database"));
                return;
            }
            let q = `SELECT _id, altLabels, conceptUri, description, name, prefferredLabel, kompetencecol, grp FROM ${COMPETENCE}  WHERE _id>0 AND conceptUri="${conceptUri}"`;
            if (this.options.getTesting()) {
                winston.info(q);
                resolve(new Competence());
            } else {
                (this.conn as MYSQL.Connection).query(q, function (error, response) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    let result: Competence = new Competence();
                    let fields: string = "";
                    if (response.length===1) {
                        for (let key in response[0]) {
                            let prop = response[0][key];
                            if (prop)
                                result[key as keyof Competence] = prop;
                        }
                    }
                    resolve(result);
                });
            }
        });
    }

    storeCompetence(competence: Competence) {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined)
                reject(new Error("Not connected to database"));
            else {
                let q = `INSERT INTO ${COMPETENCE} (conceptUri, prefferredLabel, grp) VALUES ("${competence.get("conceptUri")}", "${competence.get("prefferredLabel")}", "${competence.get("grp")}")`;
                if (this.options.getTesting()) {
                    winston.info(q);
                    resolve();
                } else {
                    (this.conn as MYSQL.Connection).query(q, function (error) {
                        if (error) reject(error);
                        resolve();
                    });
                }
            }
        });
    }

    updateCompetence(competence: Competence) {
        return new Promise((resolve,reject) => {
            let getProperty = function <T, K extends keyof T>(obj: T, key: K) {
                return obj[key];  // Inferred type is T[K]
            };
            if (this.conn == undefined)
                reject(new Error("Not connected to database"));
            else if (!competence.get("conceptUri") && !competence.get("_id"))
                reject(new Error("No competence key provided"));
            else {
                let fields: string = "";
                for (let key in competence) {
                    let prop = getProperty(competence,key as keyof Competence);
                    if (typeof prop == "object")
                        prop = (prop as object).toString();
                    if (prop !== undefined) {
                        if (fields!="") {
                            fields+=",";
                        }
                        fields += (key+"=");
                        if (typeof prop === "string")
                            fields += ('"'+prop+'"');
                        else
                            fields += prop;
                    }
                }
                let q = `UPDATE ${COMPETENCE} SET ${fields} WHERE _id="${competence.get("_id")}" OR conceptUri="${competence.get("conceptUri")}"`;
                winston.info(q);
                if (this.options.getTesting()) {
                    resolve();
                } else {
                    (this.conn as MYSQL.Connection).query(q, function (error) {
                        if (error) reject(error);
                        resolve();
                    });
                }
            }
        });
    }

    async execute(query: string) {
        return new Promise((resolve,reject) => {
            if (this.options.getTesting()) {
                winston.info(query);
                resolve();
            } else {
                (this.conn as MYSQL.Connection).query(query, function (error) {
                    if (error) reject(error);
                    resolve();
                });
            }
        });
    }
}

