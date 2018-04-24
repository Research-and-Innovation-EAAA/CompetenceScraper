import MYSQL from "mysql";
import stream from "stream";

export class DatabaseOptions {
    private host: string = "localhost";
    private port: number = 3306;
    private database: string | undefined = undefined;
    private username: string = "root";
    private password: string | undefined = undefined;

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

    about(): string {
        return "Server="+this.getHost()+";Port="+this.getPort()+";Database="+this.getDatabase()+";Uid="+this.getUsername()+";Pwd="+this.getPassword();
    };

    constructor() {};
}

export class Database {
    private conn: MYSQL.Connection;
    private connected = false;

    constructor(private options: DatabaseOptions) {
        this.conn = MYSQL.createConnection({
            host: this.options.getHost(),
            port: this.options.getPort(),
            user: this.options.getUsername(),
            password: this.options.getPassword(),
            database: this.options.getDatabase()
        });
        this.connected = true;
    }

    disconnect() {
        if (this.isConnected()) {
            (this.conn as MYSQL.Connection).destroy();
        }
        this.connected = false;
    }

    isConnected() : boolean {
        return this.connected;
    }

    about(): string {
        return this.options.about();
    };

    async getCompetence() {
        return new Promise((resolve,reject) => {
            this.conn.query('SELECT conceptUri from kompetence', function (error, results, fields) {
                if (error) reject(error);
                resolve(results);
            });
        });
    }
}

