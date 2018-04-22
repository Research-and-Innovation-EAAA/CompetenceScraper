
export class DatabaseOptions {
    private host: string = "localhost";
    private port: number = 3306;
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

    setUsername(username : string | undefined) : DatabaseOptions {
        this.username = username && username.length > 0 ? username : this.username;
        return this;
    }
    getUsername() {
        return this.username;
    }

    setPassword(password : string | undefined) : DatabaseOptions {
        this.password = password && password.length > 0 ? password : this.password;
        return this;
    }
    getPassword() {
        return this.password;
    }

    about(): string {
        return this.getUsername()+"\\"+this.getPassword()+"@"+this.getHost()+":"+this.getPort();
    };

    constructor() {};
}


export class Database {
    constructor(private Options: DatabaseOptions) {};

    about(): string {
        return this.Options.about();
    };
}
