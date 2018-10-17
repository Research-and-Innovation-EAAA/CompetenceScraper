class ICompetence {
    _id : number | undefined;
    altLabels: string | undefined;
    conceptUri: string | undefined;
    description: string | undefined;
    name: string | undefined;
    advertCount: number | undefined;
    prefferredLabel: string | undefined;
    defaultSearchPatterns: string | undefined;
    lastMatch: string | undefined; // date time string format from MySQL
    lastUpdated: string | undefined; // date time string format from MySQL
    overriddenSearchPatterns: string | undefined;
    grp: string | undefined;
}

type Partial<T> = {
    [P in keyof T]?: T[P];
}

export class Competence extends ICompetence {
    
    setMore(values : Partial<ICompetence>) {
        Object.keys(values).forEach(key => {
            let k = key as keyof ICompetence;
            this.set(k, (values as any)[k]);
        });
    }

    set<K extends keyof ICompetence>(key: K, value: ICompetence[K]): void {
        this[key] = value;
    }

    get<K extends keyof ICompetence>(key: K) : ICompetence[K] {
        return this[key];
    }

    constructor(initialValues : Partial<ICompetence> = {}) {
        super();

        // assign initial values
        this.setMore(initialValues);
    }
}

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
export interface Competence extends Omit<Competence, keyof ICompetence> { }


