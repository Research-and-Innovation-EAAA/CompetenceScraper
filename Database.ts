import {Competence} from "./Competence";
import {Datafield} from "./Datafield";
import * as MYSQL from "mysql";
import * as winston from "winston";
import {isObject} from "util";
import {CompetenceHierarchy} from "./CompetenceHierarchy";

const COMPETENCE = "kompetence";
const DATAFIELD = "datafield"
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

    getCount(query: string) : Promise<number> {
        return new Promise((resolve,reject) => {
            if (this.options.getTesting()) {
                winston.info(query);
                resolve(0);
            } else {
                (this.conn as MYSQL.Connection).query(query, function (error, response) {
                    if (error) reject(error);
	                let result : number = NaN;
                    for (let key in response[0])
                       result = response[0][key];
                    resolve(result);
                });
            }
        });
    };
    get(query: string) : Promise<any> {
        return new Promise((resolve,reject) => {
            if (this.options.getTesting()) {
                winston.info(query);
                resolve(0);
            } else {
                (this.conn as MYSQL.Connection).query(query, function (error, response) {
                    if (error) reject(error);

                    if(response.length > 0){
                        let result : any;
                        for (let key in response[0]) {
                            result = response[0][key]
                        }
                        resolve(result);
                    }
                    resolve(0);
                });
            }
        });
    };

    loadCompetencies() : Promise<Competence[]> {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined) {
                reject(new Error("Not connected to database"));
                return;
            }
            let q = `SELECT _id, advertCount, altLabels, conceptUri, description, name, lastMatch, lastUpdated, prefferredLabel, kompetencecol, defaultSearchPatterns, overriddenSearchPatterns, grp FROM ${COMPETENCE}`;
            //let q = `SELECT _id, altLabels, conceptUri, description, name, prefferredLabel, kompetencecol, defaultSearchPatterns, overriddenSearchPatterns, grp FROM ${COMPETENCE} WHERE overriddenSearchPatterns is not null`;
            if (this.options.getTesting()) {
                winston.info(q);
                resolve([]);
            } else {
                (this.conn as MYSQL.Connection).query(q, function (error, response) {
                    if (error) reject(error);
                    let result: Array<Competence> = [];
                    for (let i=0 ; i<response.length ; i++) {
                        result[i] = new Competence();
                        for (let key in response[i]) {
                            let prop = response[i][key];
                            if (prop !== null && prop !== undefined)
                                result[i][key as keyof Competence] = prop;
                        }
                    }
                    resolve(result);
                });
            }
        });
    }
    loadDatafields() : Promise<Datafield[]> {
        return new Promise((resolve,reject) => {
            if (this.conn == undefined) {
                reject(new Error("Not connected to database"));
                return;
            }
            let q = `SELECT * FROM ${DATAFIELD}`;
            if (this.options.getTesting()) {
                winston.info(q);
                resolve([]);
            } else {
                (this.conn as MYSQL.Connection).query(q, function (error, response) {
                    if (error) reject(error);
                    let result: Array<Datafield> = [];
 		    if (response) {
			for (let i=0 ; i<response.length ; i++) {
			    result[i] = new Datafield();
			    for (let key in response[i]) {
				let prop = response[i][key];
				if (prop !== null && prop !== undefined)
				    result[i][key as keyof Datafield] = prop;
			    }
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
            let q = `SELECT _id, altLabels, conceptUri, description, name, prefferredLabel, kompetencecol, defaultSearchPatterns, overriddenSearchPatterns, grp FROM ${COMPETENCE}  WHERE _id>0 AND conceptUri="${conceptUri}"`;
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
                let grpValue = competence.get("grp");
                if (!grpValue || grpValue=="")
                    grpValue = "Misc";
                let labelValue = competence.get("prefferredLabel");
                let uriValue = competence.get("conceptUri");
                let q = `INSERT INTO ${COMPETENCE} (conceptUri, prefferredLabel, grp) VALUES ("${uriValue}", "${labelValue}", "${grpValue}")`;
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
                        if (prop instanceof Date)
                            prop = (prop as Date).toISOString().replace(/\Z$/g, '');
                        else
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
                let condition = competence.get("_id")?`_id=${competence.get("_id")}`:`conceptUri="${competence.get("conceptUri")}"`;
                let q = `UPDATE ${COMPETENCE} SET ${fields} WHERE  ${condition}`;
                winston.info(`Update query: ${q}`);
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

    async findDistinctGroups(){
        return new Promise<Array<string>>((resolve, reject) => {
            const query = 'select distinct grp from kompetence';
            (this.conn as MYSQL.Connection).query(query,  function (error, response) {
                if (error){
                    reject(error)
                }
                else{
                    if (response.length > 0){
                        let groupList = new Array<string>();
                        for (let j = 0; j < response.length; j++) {
                            if (response[j]) {
                                groupList.push(response[j].grp);
                            }
                        }
                        resolve(groupList);
                    }
                    else{
                        reject(new Error("No groups were found in findDistinctGroups"));
                    }
                }
            })
        })
    }


    async findSubCompetencies(competenceList: Array<CompetenceHierarchy>, trackList: Array<string>) { //IS RECURSIVE
        return new Promise<Array<CompetenceHierarchy>>(async (resolve, reject) => {
            if (this.conn == undefined) {
                reject(new Error("Not connected to database"));
                return;
            }
            let finalList: Array<CompetenceHierarchy> = [];
            for (let i = 0; i < competenceList.length; i++) {
                finalList[i] = new CompetenceHierarchy(competenceList[i].text);
                finalList[i].children = await this.findSubCompetenciesHelper(competenceList[i].text, trackList);
            }
            resolve(finalList);
        })
    }

    private async findSubCompetenciesHelper(superCompetence: string, trackList: Array<string>) {
        return new Promise<Array<CompetenceHierarchy>>((resolve, reject) => {
            let database = this;
            const query = 'select k.prefferredLabel from kompetence k, kompetence_kategorisering kk where k.conceptUri = kk.subkompetence and kk.superkompetence = (select distinct k.conceptUri from kompetence k, kompetence_kategorisering kk where k.prefferredLabel = "' +  superCompetence + '" and k.conceptUri = kk.superkompetence)';
            (this.conn as MYSQL.Connection).query(query,  function (error, response) {
                if (error) {
                    reject("Error in the recursive function findSubCompetencies:\n" + error);
                    return;
                }
                let subCompetencies: CompetenceHierarchy[] = [];

                if (response.length > 0) {
                    let subList: Array<string> = [];
                    for (let j = 0; j < response.length; j++) {
                        if (response[j]) {
                            subList.push(response[j].prefferredLabel);
                        }
                    }
                    subList = subList.filter(function (el) {
                        return trackList.indexOf(el) < 0;
                    });
                    let newTrackList = trackList;
                    for (let subCompetence of subList) {
                        newTrackList.push(subCompetence);
                    }
                    let searchList: Array<CompetenceHierarchy> = [];
                    for (let competence of subList) {
                        searchList.push(new CompetenceHierarchy(competence))
                    }
                    (database.findSubCompetencies(searchList, newTrackList)).then((children)=> {
                        subCompetencies = children;
                        resolve(subCompetencies);
                    }, (failure) =>{
                        reject(failure);
                    })
                }
                else{
                    resolve(subCompetencies);
                }
            })
        })
    }

    storeShinyTreeJSON(JSON: string) {
        return new Promise((resolve, reject) => {
            let alreadyExists = false;
            let database = this;
            let q = 'select * from global';
            (this.conn as MYSQL.Connection).query(q, function (error, response) {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.length > 0) {
                    resolve(database.storeShinyTreeJSONHelper(JSON, true));
                }
                else{
                    resolve(database.storeShinyTreeJSONHelper(JSON, false));
                }
            });

        });
    }

    private storeShinyTreeJSONHelper(JSON: string, alreadyExists: boolean){
        return new Promise((resolve, reject) => {
            let query = '';
            if (alreadyExists) {
                query = 'update global set shinyTreeJSON = \'' + JSON + "\' where _id = 1";
            }
            else {
                query = 'insert into global(shinyTreeJSON) values(\'' + JSON + '\')';
            }
            (this.conn as MYSQL.Connection).query(query, function (error) {
                if (error) reject(error);
                resolve();
            });
        })
    }

    async findTopAdvertId(){
        return new Promise((resolve, reject) => {
            let query = 'select max(_id) as amount from annonce';
            (this.conn as MYSQL.Connection).query(query, function(error, response){
                if (error) reject(error);
                else{
                    if (response.length > 0){
                        resolve(response);
                    }
                }
            })
        })
    }

    async loadAdvertTextNoNumberFormat(_id: number){
        return new Promise((resolve, reject) => {
            let query = 'select _id, searchable_body from annonce where _id = ' + _id + ' and numberFormat_body is NULL';
            (this.conn as MYSQL.Connection).query(query, function(error, response){
                if (error) reject(error);
                else{
                    resolve(response);
                }
            })
        })
    }

    async checkDictionaryWord(word: string){
        return new Promise((resolve, reject) => {
            let query = 'select _id from machine_word_dictionary where word = "' + word + '"';
            let database = this;
            (this.conn as MYSQL.Connection).query(query, function(error, response){
                if (error) reject("Failed to select _id in dictionary" + error);
                else{
                    if (response.length > 0){
                        resolve(response);
                    }
                    else{
                        let q2 = 'insert into machine_word_dictionary(word) values("' + word + '")';
                        (database.conn as MYSQL.Connection).query(q2, function(error, response){
                            if (error) reject(error);
                            else{
                                (database.conn as MYSQL.Connection).query(query, function(error, response){
                                    if (error) reject(error);
                                    else{
                                        if (response.length > 0){
                                            resolve(response);
                                        }
                                        else{
                                            reject("ERROR: FAILED TO INSERT NEW WORD INTO DICTIONARY")
                                        }
                                    }
                                })
                            }
                        })
                    }
                }
            })
        })
    }

}

